# 🎬 DragonFilm

> **Phim Hay - Share Ngay** | Website xem phim online miễn phí

## 🚀 Deploy lên GitHub Pages

1. Tạo repository mới trên GitHub (ví dụ: `DragonFilm`)
2. Upload toàn bộ thư mục này lên repo
3. Vào **Settings → Pages → Source**: chọn branch `main`, thư mục `/root`
4. Lưu → sau ~1 phút web sẽ live tại: `https://yourusername.github.io/DragonFilm/`

## 📁 Cấu Trúc

```
DragonFilm/
├── index.html          # Trang chủ
├── movie.html          # Trang xem phim + player
├── history.html        # Lịch sử xem
├── css/
│   ├── style.css       # Stylesheet chính
│   └── player.css      # Stylesheet cho player
├── js/
│   ├── api.js          # Layer gọi API phim
│   ├── auth.js         # Auth + utilities dùng chung
│   ├── main.js         # Logic trang chủ
│   └── player.js       # Logic player
└── assets/
    └── logo.png        # Logo DragonFilm
```

## 🌐 Nguồn Phim

| Server | Tên | API Base |
|--------|-----|----------|
| Server 1 | KKPhim (KKP) | `phimapi.com` |
| Server 2 | OPhim (OP) | `ophim1.com` |
| Server 3 | NguonC (NC) | `phim.nguonc.com` |

## ✨ Tính Năng

- **Trang chủ**: Banner phim nổi bật, lọc thể loại/quốc gia/loại phim, tìm kiếm
- **Player**: HTML5 video hoặc iframe embed, play/pause click, tua ±10s, giữ = 2×, PiP, fullscreen
- **Auth**: Đăng nhập/đăng ký bằng localStorage
- **Lịch sử**: Tự động lưu phim đã xem + thời gian xem dở
- **Responsive**: Mobile-first, hỗ trợ màn hình dọc

## 🎨 Màu sắc

- Nền tối: `#050a05`
- Xanh neon: `#39ff14`
- Font: Bebas Neue (display) + Rajdhani (title) + Nunito (body)
