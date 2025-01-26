mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let database_name = env!("SQLITE_DATABASE_NAME");

    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(
                    &format!("sqlite:{}.db", database_name),
                    db::migration::migrations(),
                )
                .build(),
        )
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
