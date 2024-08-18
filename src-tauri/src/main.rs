// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
  include_image,
  menu::{MenuBuilder, MenuItemBuilder},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  AppHandle, Manager,
};

fn main() {
  tauri::Builder::default()
    .setup(move |app| {
      let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
      let hide = MenuItemBuilder::with_id("hide", "Hide").build(app)?;
      let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

      let menu = MenuBuilder::new(app).items(&[&show, &hide, &quit]).build()?;

      TrayIconBuilder::new()
        .tooltip("Clipboard Image Editor")
        .icon(include_image!("./icons/32x32.png"))
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
          "show" => {
            show_window(app);
          }
          "hide" => {
            if let Some(window) = app.get_webview_window("main") {
              window.hide().expect("Failed to hide window");
            }
          }
          "quit" => {
            app.exit(0);
          }
          _ => {}
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            let app = tray.app_handle();
            show_window(app);
          }
        })
        .build(app)?;

      Ok(())
    })
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .invoke_handler(tauri::generate_handler![])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn show_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    window.center().expect("Failed to show window");
    window.show().expect("Failed to show window");
    window.set_focus().expect("Failed to focus window");
  }
}
