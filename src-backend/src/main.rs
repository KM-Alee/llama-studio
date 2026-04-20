use llamastudio_backend::app::{AppRuntime, init_tracing, shutdown_signal};
use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();
    let runtime = AppRuntime::new().await?;
    runtime.run(shutdown_signal()).await
}
