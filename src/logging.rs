use chrono::Local;
use std::fs;
use std::path::Path;

pub fn setup_logger() -> Result<(), Box<dyn std::error::Error>> {
    let logs_dir = Path::new("logs");
    if !logs_dir.exists() {
        fs::create_dir(logs_dir)?;
    }

    let now = Local::now();
    let time_prefix = now.format("%d%m%y-%H%M").to_string(); // ddmmyy-hhmm

    let session_num = get_next_session_num(logs_dir, &time_prefix)?;
    let log_filename = format!("{}-{}.log", time_prefix, session_num);
    let log_path = logs_dir.join(log_filename);

    println!("Initializing logger, writing to: {:?}", log_path);

    let colors = fern::colors::ColoredLevelConfig::new().info(fern::colors::Color::Green);

    fern::Dispatch::new()
        .format(move |out, message, record| {
            out.finish(format_args!(
                "[{} {} {}] {}",
                chrono::Local::now().format("%Y-%m-%dT%H:%M:%SZ"),
                colors.color(record.level()),
                record.target(),
                message
            ))
        })
        .level(log::LevelFilter::Info)
        .level_for("actix_server", log::LevelFilter::Warn) // Suppress actix startup logs as before
        .chain(std::io::stdout())
        .chain(fern::log_file(log_path)?)
        .apply()?;

    Ok(())
}

fn get_next_session_num(dir: &Path, prefix: &str) -> std::io::Result<u32> {
    let mut max_session = 0;

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_file() {
            if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                if filename.starts_with(prefix) && filename.ends_with(".log") {
                    // Expected format: <prefix>-<num>.log
                    // prefix len + 1 (for hyphen)
                    let start_idx = prefix.len() + 1;
                    let end_idx = filename.len() - 4; // .log

                    if start_idx < filename.len() && end_idx > start_idx {
                        let num_part = &filename[start_idx..end_idx];
                        if let Ok(num) = num_part.parse::<u32>() {
                            if num > max_session {
                                max_session = num;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(max_session + 1)
}
