use serde::Deserialize;
use std::fs;

mod server;

#[derive(Clone, Debug, Deserialize)]
pub struct GeminiConfig {
    pub model: String,
    pub api_base_url: String,
    pub api_version: String,
    pub temperature: f32,
    pub thinking_budget: i32,
}

#[derive(Clone, Debug, Deserialize)]
pub struct QwenConfig {
    pub model: String,
    pub api_url: Option<String>,
    pub stream: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Config {
    pub active_model: String,
    pub server_host: String,
    pub server_port: u16,
    pub gemini: GeminiConfig,
    pub qwen: QwenConfig,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    env_logger::init();

    let config_str = fs::read_to_string("config.toml").expect("Failed to read config.toml");
    let config: Config = toml::from_str(&config_str).expect("Failed to parse config.toml");

    server::run(config).await
}
