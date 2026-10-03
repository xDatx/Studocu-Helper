# Studocu + Scribd Helper

Extension Chrome giúp xuất tài liệu **Studocu** và **Scribd** ra PDF, dùng chính chức năng in gốc của trình duyệt.

> **v2.1.0**: thêm hỗ trợ Scribd, giao diện popup mới và sửa lỗi mất kết nối sau khi xóa cookie. Từ v2.0.0 dự án đã chuyển sang cách in native thay cho cách cũ (unblur + export). Bản cũ vẫn còn ở tag `v1-old`.

## Tính năng

- **In PDF (Studocu & Scribd)**: tự cuộn qua toàn bộ tài liệu để tải hết các trang, sau đó chỉ giữ lại phần nội dung tài liệu và mở hộp thoại in của trình duyệt.
- **Chỉnh tốc độ cuộn**: 4 mức (Chậm / Vừa / Nhanh / Rất nhanh), được nhớ cho lần sau. Mạng yếu thì chọn chậm để không sót trang.
- **Khôi phục trang**: trả lại giao diện như ban đầu sau khi in.
- **Xóa cookie & tải lại** (chỉ Studocu): xóa cookie của Studocu rồi reload tab, dùng khi trang bị giới hạn hoặc lỗi hiển thị. Popup tự kết nối lại sau khi trang tải xong, không cần đóng mở lại.

## Cài đặt

1. Vào mục [Releases](../../releases) tải file `.zip` mới nhất, hoặc bấm **Code → Download ZIP**.
2. Giải nén ra một thư mục.
3. Mở `chrome://extensions` trên Chrome / Edge / Brave...
4. Bật **Developer mode** (góc trên bên phải).
5. Bấm **Load unpacked** và chọn thư mục vừa giải nén (thư mục chứa `manifest.json`).

Yêu cầu: Chrome 119 trở lên.

## Cách dùng

1. Mở tài liệu cần lưu trên `studocu.com`, `studocu.vn` hoặc `scribd.com`.
2. Bấm biểu tượng extension để mở popup. Dòng dưới tiêu đề sẽ cho biết đang nhận diện Studocu hay Scribd.
3. Chọn tốc độ cuộn.
4. Bấm **In PDF** và chờ extension nạp hết các trang.
5. Khi hộp thoại in hiện ra, chọn **Save as PDF** (Lưu dưới dạng PDF), để **Margins: None** rồi lưu.
6. Bấm **Khôi phục trang** nếu muốn quay lại giao diện bình thường.

Lưu ý riêng cho từng trang:

- **Studocu**: nếu trang bị lỗi hoặc không tải được nội dung, thử bấm **Xóa cookie Studocu & tải lại** rồi làm lại từ bước 3.
- **Scribd**: hãy mở hẳn tài liệu (thấy các trang) trước khi mở popup. Nếu popup báo chưa tìm thấy trang tài liệu, cuộn nhẹ trang một chút rồi mở lại popup.

## Cách hoạt động

**Studocu**
- Cuộn từng đoạn để Studocu tải đủ các trang tài liệu (`.page-content`).
- Đo kích thước từng trang, ẩn mọi phần tử không liên quan (quảng cáo, thanh menu...) và gỡ các giới hạn CSS để mỗi trang in đúng một tờ.

**Scribd**
- Tìm viewer chứa các trang (`.outer_page`), kể cả khi nằm trong iframe, rồi cuộn để nạp đủ trang.
- Đo kích thước từng trang và tạo khổ giấy `@page` tương ứng, nên tài liệu có nhiều khổ khác nhau vẫn in đúng. Trang tự được khôi phục sau khi đóng hộp thoại in.

Cả hai đều gọi chức năng in gốc của trình duyệt nên chữ trong PDF vẫn chọn/copy được, không bị biến thành ảnh.

## Quyền extension sử dụng

| Quyền | Dùng để |
|---|---|
| `activeTab`, `scripting` | Chèn CSS/JS xử lý trang vào tab đang mở |
| `cookies` | Xóa cookie của Studocu |
| `storage` | Lưu cài đặt |
| `webNavigation` | Liệt kê các frame của tab để tìm viewer Scribd |
| `*.studocu.com`, `*.studocu.vn`, `*.scribd.com` | Chỉ hoạt động trên các tên miền này |

Extension không thu thập hay gửi dữ liệu đi đâu cả, mọi thứ chạy ngay trên máy bạn.

## Cấu trúc dự án

```
├── manifest.json     # Cấu hình extension (Manifest V3)
├── background.js     # Service worker, xử lý xóa cookie
├── popup.html/css/js # Giao diện popup và điều khiển
├── native-print.js   # Studocu: cuộn, đo trang, chuẩn bị in
├── native-print.css  # Studocu: style áp dụng khi in
└── content.js        # Scribd: nạp trang, đo khổ giấy, chuẩn bị in
```

## Lưu ý

- Dự án chỉ phục vụ mục đích học tập và dùng cá nhân. Hãy tôn trọng bản quyền của tác giả tài liệu và điều khoản của Studocu, Scribd.
- Các trang có thể đổi giao diện bất cứ lúc nào làm extension ngừng hoạt động. Nếu gặp lỗi, mở [Issue](../../issues) kèm link tài liệu (nếu được) và mô tả lỗi.

## Changelog

### 2.1.0
- Thêm hỗ trợ Scribd (nhận diện viewer, nạp trang, in đúng khổ từng trang).
- Giao diện popup mới.
- Sửa lỗi `Could not establish connection. Receiving end does not exist` khi bấm In PDF ngay sau khi xóa cookie: popup nay chờ trang tải lại xong và tự kết nối lại, đồng thời tự inject lại script nếu mất kết nối.

### 2.0.0
- Viết lại toàn bộ: chuyển sang in native thay cho cách cũ.
- Thêm chỉnh tốc độ cuộn, nút khôi phục trang, nút xóa cookie.
- Chuyển hoàn toàn sang Manifest V3.

### 1.x
- Bản cũ, xem tag `v1-old`.

## Stars ⭐

<img width="2748" height="2106" alt="star-history-2026101" src="https://github.com/user-attachments/assets/8426b98e-950a-46cf-b48f-81dcc0ef69e0" />
