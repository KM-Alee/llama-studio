use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, broadcast};

use crate::services::config_store::ConfigStore;

/// Unique identifier for a download task.
pub type DownloadId = String;

/// Represents the current state of a download.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub id: DownloadId,
    pub filename: String,
    pub url: String,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub status: DownloadStatus,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Complete,
    Failed,
    Cancelled,
}

/// Manages concurrent model downloads with progress tracking.
pub struct DownloadManager {
    config: Arc<ConfigStore>,
    downloads: Arc<Mutex<HashMap<DownloadId, DownloadProgress>>>,
    progress_tx: broadcast::Sender<DownloadProgress>,
}

impl DownloadManager {
    pub fn new(config: Arc<ConfigStore>) -> Self {
        let (progress_tx, _) = broadcast::channel(64);
        Self {
            config,
            downloads: Arc::new(Mutex::new(HashMap::new())),
            progress_tx,
        }
    }

    /// Subscribe to download progress events.
    #[allow(dead_code)]
    pub fn subscribe(&self) -> broadcast::Receiver<DownloadProgress> {
        self.progress_tx.subscribe()
    }

    /// List all active and recent downloads.
    pub async fn list(&self) -> Vec<DownloadProgress> {
        let downloads = self.downloads.lock().await;
        downloads.values().cloned().collect()
    }

    /// Start downloading a file from a URL into the models directory.
    pub async fn start_download(&self, url: String, filename: String) -> Result<DownloadId> {
        let id = uuid::Uuid::new_v4().to_string();
        let models_dir = self.config.get_models_dir().await;
        let dest = PathBuf::from(&models_dir).join(&filename);

        // Ensure models directory exists
        tokio::fs::create_dir_all(&models_dir).await?;

        let progress = DownloadProgress {
            id: id.clone(),
            filename: filename.clone(),
            url: url.clone(),
            total_bytes: 0,
            downloaded_bytes: 0,
            status: DownloadStatus::Queued,
            error: None,
        };

        {
            let mut downloads = self.downloads.lock().await;
            downloads.insert(id.clone(), progress.clone());
        }

        let _ = self.progress_tx.send(progress);

        // Spawn the download task
        let downloads = Arc::clone(&self.downloads);
        let tx = self.progress_tx.clone();
        let task_id = id.clone();

        tokio::spawn(async move {
            if let Err(e) =
                run_download(task_id.clone(), url, dest, downloads.clone(), tx.clone()).await
            {
                let mut downloads = downloads.lock().await;
                if let Some(dl) = downloads.get_mut(&task_id) {
                    dl.status = DownloadStatus::Failed;
                    dl.error = Some(e.to_string());
                    let _ = tx.send(dl.clone());
                }
            }
        });

        Ok(id)
    }

    /// Cancel an in-progress download.
    pub async fn cancel(&self, id: &str) -> Result<()> {
        let mut downloads = self.downloads.lock().await;
        if let Some(dl) = downloads.get_mut(id) {
            dl.status = DownloadStatus::Cancelled;
            let _ = self.progress_tx.send(dl.clone());
        }
        Ok(())
    }

    /// Remove a completed or failed download from the list.
    #[allow(dead_code)]
    pub async fn remove(&self, id: &str) {
        let mut downloads = self.downloads.lock().await;
        downloads.remove(id);
    }
}

/// Execute the download, streaming data and reporting progress.
async fn run_download(
    id: DownloadId,
    url: String,
    dest: PathBuf,
    downloads: Arc<Mutex<HashMap<DownloadId, DownloadProgress>>>,
    tx: broadcast::Sender<DownloadProgress>,
) -> Result<()> {
    use futures::StreamExt;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()?;

    let response = client.get(&url).send().await?;

    let total = response.content_length().unwrap_or(0);

    {
        let mut dls = downloads.lock().await;
        if let Some(dl) = dls.get_mut(&id) {
            dl.total_bytes = total;
            dl.status = DownloadStatus::Downloading;
            let _ = tx.send(dl.clone());
        }
    }

    let mut file = tokio::fs::File::create(&dest).await?;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    // Report progress at most every 500ms to avoid event flooding.
    let report_interval_bytes = if total > 0 { total / 200 } else { 1_048_576 };
    let mut last_reported: u64 = 0;

    while let Some(chunk) = stream.next().await {
        // Check for cancellation
        {
            let dls = downloads.lock().await;
            if let Some(dl) = dls.get(&id) {
                if dl.status == DownloadStatus::Cancelled {
                    drop(dls);
                    // Clean up partial file
                    let _ = tokio::fs::remove_file(&dest).await;
                    return Ok(());
                }
            }
        }

        let chunk = chunk?;
        use tokio::io::AsyncWriteExt;
        file.write_all(&chunk).await?;
        downloaded += chunk.len() as u64;

        if downloaded - last_reported >= report_interval_bytes || downloaded == total {
            last_reported = downloaded;
            let mut dls = downloads.lock().await;
            if let Some(dl) = dls.get_mut(&id) {
                dl.downloaded_bytes = downloaded;
                let _ = tx.send(dl.clone());
            }
        }
    }

    // Mark complete
    {
        let mut dls = downloads.lock().await;
        if let Some(dl) = dls.get_mut(&id) {
            dl.downloaded_bytes = downloaded;
            dl.status = DownloadStatus::Complete;
            let _ = tx.send(dl.clone());
        }
    }

    tracing::info!(filename = %dest.display(), bytes = downloaded, "Download complete");
    Ok(())
}
