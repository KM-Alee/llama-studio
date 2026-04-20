use serde::Serialize;
use std::env;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct RuntimeDependencyStatus {
    pub key: &'static str,
    pub label: &'static str,
    pub required: bool,
    pub installed: bool,
    pub resolved_path: Option<String>,
    pub install_url: &'static str,
    pub help_text: &'static str,
}

pub fn command_for_llama_server(configured_server_path: &str) -> PathBuf {
    resolve_llama_server_path(configured_server_path)
        .unwrap_or_else(|| PathBuf::from(default_command_name("llama-server")))
}

pub fn command_for_llama_cli(configured_server_path: &str) -> PathBuf {
    resolve_llama_cli_path(configured_server_path)
        .unwrap_or_else(|| PathBuf::from(default_command_name("llama-cli")))
}

pub fn detect_runtime_dependencies(configured_server_path: &str) -> Vec<RuntimeDependencyStatus> {
    let llama_server = resolve_llama_server_path(configured_server_path);
    let llama_cli = resolve_llama_cli_path(configured_server_path);
    let hugging_face_cli = resolve_from_path(&["hf", "huggingface-cli"]);

    vec![
        RuntimeDependencyStatus {
            key: "llama_server",
            label: "llama-server",
            required: true,
            installed: llama_server.is_some(),
            resolved_path: llama_server.map(|path| path.display().to_string()),
            install_url: "https://github.com/ggerganov/llama.cpp/releases",
            help_text:
                "Required to run local inference. Download the official llama.cpp release for your platform, then point Binary Path to llama-server.",
        },
        RuntimeDependencyStatus {
            key: "llama_cli",
            label: "llama-cli",
            required: false,
            installed: llama_cli.is_some(),
            resolved_path: llama_cli.map(|path| path.display().to_string()),
            install_url: "https://github.com/ggerganov/llama.cpp/releases",
            help_text:
                "Optional but recommended. LlamaStudio uses llama-cli for local model inspection and metadata extraction.",
        },
        RuntimeDependencyStatus {
            key: "huggingface_cli",
            label: "Hugging Face CLI",
            required: false,
            installed: hugging_face_cli.is_some(),
            resolved_path: hugging_face_cli.map(|path| path.display().to_string()),
            install_url: "https://huggingface.co/docs/huggingface_hub/guides/cli",
            help_text:
                "Optional only. LlamaStudio can browse and download models directly, so the Hugging Face CLI is not required.",
        },
    ]
}

pub fn resolve_llama_server_path(configured_server_path: &str) -> Option<PathBuf> {
    resolve_related_binary(configured_server_path, "llama-server")
        .or_else(|| resolve_from_path(&["llama-server"]))
}

pub fn resolve_llama_cli_path(configured_server_path: &str) -> Option<PathBuf> {
    resolve_related_binary(configured_server_path, "llama-cli")
        .or_else(|| resolve_from_path(&["llama-cli"]))
}

fn resolve_related_binary(configured_server_path: &str, binary_stem: &str) -> Option<PathBuf> {
    if configured_server_path.is_empty() {
        return None;
    }

    let configured = Path::new(configured_server_path);
    let binary_name = platform_binary_name(binary_stem);

    let candidates = if configured.is_dir() {
        vec![configured.join(binary_name)]
    } else if is_binary_name(configured, binary_stem) {
        if binary_stem == "llama-server" {
            vec![configured.to_path_buf()]
        } else {
            configured
                .parent()
                .map(|parent| vec![parent.join(binary_name)])
                .unwrap_or_default()
        }
    } else {
        configured
            .parent()
            .map(|parent| vec![parent.join(binary_name)])
            .unwrap_or_else(|| vec![configured.to_path_buf()])
    };

    candidates.into_iter().find(|path| path.is_file())
}

fn resolve_from_path(binary_stems: &[&str]) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    let directories: Vec<PathBuf> = env::split_paths(&path).collect();

    for stem in binary_stems {
        let binary_name = platform_binary_name(stem);
        for dir in &directories {
            let candidate = dir.join(&binary_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

fn platform_binary_name(binary_stem: &str) -> String {
    if cfg!(windows) {
        format!("{binary_stem}.exe")
    } else {
        binary_stem.to_string()
    }
}

fn default_command_name(binary_stem: &str) -> String {
    binary_stem.to_string()
}

fn is_binary_name(path: &Path, binary_stem: &str) -> bool {
    let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };

    let expected = platform_binary_name(binary_stem);
    file_name.eq_ignore_ascii_case(&expected) || file_name.eq_ignore_ascii_case(binary_stem)
}
