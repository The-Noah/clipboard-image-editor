// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
  include_image,
  menu::{MenuBuilder, MenuItemBuilder},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  AppHandle, Emitter, Manager, WebviewWindow, Window,
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
              hide_window_internal(&window);
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
    .invoke_handler(tauri::generate_handler![hide_window])
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        hide_window_internal(&window.get_webview_window("main").unwrap());
        api.prevent_close();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn show_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    window.emit("load", ()).expect("Failed to emit load event");
    window.center().expect("Failed to center window");
    window.show().expect("Failed to show window");
    window.set_focus().expect("Failed to set focus");
  }
}

fn hide_window_internal(window: &WebviewWindow) {
  window.emit("reset", ()).expect("Failed to emit reset event");
  window.hide().expect("Failed to hide window");
}

#[tauri::command]
fn hide_window(_app: AppHandle, window: Window) {
  hide_window_internal(&window.get_webview_window("main").unwrap());
}
