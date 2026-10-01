# Studocu Helper

Extension Chrome giúp xuất tài liệu Studocu ra PDF, dùng chính chức năng in gốc của trình duyệt.

> **v2.0.0**: viết lại hoàn toàn. Cách cũ (unblur + export) đã được thay bằng cách in native, gọn và ổn định hơn. Bản cũ vẫn còn ở tag `v1-old`.

## Tính năng

- **In PDF**: tự cuộn qua toàn bộ tài liệu để tải hết các trang, sau đó chỉ giữ lại phần nội dung tài liệu và mở hộp thoại in của trình duyệt.
- **Chỉnh tốc độ cuộn**: 4 mức (Chậm / Vừa / Nhanh / Rất nhanh). Mạng yếu thì chọn chậm để không sót trang.
- **Khôi phục trang**: trả lại giao diện Studocu như ban đầu sau khi in.
- **Xóa cookie & tải lại**: xóa cookie của Studocu rồi reload tab, dùng khi trang bị giới hạn hoặc lỗi hiển thị.

## Cài đặt

1. Vào mục [Releases](../../releases) tải file `.zip` mới nhất, hoặc bấm **Code → Download ZIP**.
2. Giải nén ra một thư mục.
3. Mở `chrome://extensions` trên Chrome / Edge / Brave...
4. Bật **Developer mode** (góc trên bên phải).
5. Bấm **Load unpacked** và chọn thư mục vừa giải nén (thư mục chứa `manifest.json`).

Yêu cầu: Chrome 119 trở lên.

## Cách dùng

1. Mở tài liệu cần lưu trên `studocu.com` hoặc `studocu.vn`.
2. Bấm biểu tượng extension để mở popup.
3. Chọn tốc độ cuộn.
4. Bấm **In PDF** và chờ extension cuộn hết tài liệu.
5. Khi hộp thoại in hiện ra, chọn **Save as PDF** (Lưu dưới dạng PDF), để **Margins: None** rồi lưu.
6. Bấm **Khôi phục trang** nếu muốn quay lại giao diện bình thường.

Nếu trang bị lỗi hoặc không tải được nội dung, thử bấm **Xóa cookie & tải lại** rồi làm lại từ bước 2.

## Cách hoạt động

- Cuộn từng đoạn để Studocu tải đủ các trang tài liệu (`.page-content`).
- Đo kích thước từng trang, ẩn mọi phần tử không liên quan (quảng cáo, thanh menu...) và gỡ các giới hạn CSS để mỗi trang in đúng một tờ.
- Gọi chức năng in gốc của trình duyệt nên chữ trong PDF vẫn chọn/copy được, không bị biến thành ảnh.

## Quyền extension sử dụng

| Quyền | Dùng để |
|---|---|
| `activeTab`, `scripting` | Chèn CSS/JS xử lý trang vào tab Studocu đang mở |
| `cookies` | Xóa cookie của Studocu |
| `storage`, `webNavigation` | Lưu cài đặt và theo dõi điều hướng trang |
| `*.studocu.com`, `*.studocu.vn` | Chỉ hoạt động trên hai tên miền này |

Extension không thu thập hay gửi dữ liệu đi đâu cả, mọi thứ chạy ngay trên máy bạn.

## Cấu trúc dự án

```
├── manifest.json     # Cấu hình extension (Manifest V3)
├── background.js     # Service worker, xử lý xóa cookie
├── popup.html/css/js # Giao diện popup
├── native-print.js   # Logic cuộn, đo trang, chuẩn bị in
└── native-print.css  # Style áp dụng khi in
```

## Lưu ý

- Dự án chỉ phục vụ mục đích học tập và dùng cá nhân. Hãy tôn trọng bản quyền của tác giả tài liệu và điều khoản của Studocu.
- Studocu có thể đổi giao diện bất cứ lúc nào làm extension ngừng hoạt động. Nếu gặp lỗi, mở [Issue](../../issues) kèm link tài liệu (nếu được) và mô tả lỗi.

## Changelog

### 2.0.0
- Viết lại toàn bộ: chuyển sang in native thay cho cách cũ.
- Thêm chỉnh tốc độ cuộn, nút khôi phục trang, nút xóa cookie.
- Chuyển hoàn toàn sang Manifest V3.

### 1.x
- Bản cũ, xem tag `v1-old`.
