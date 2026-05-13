# DragonFilm

**DragonFilm** là website xem phim online dạng static web app, chạy trực tiếp bằng HTML, CSS và JavaScript thuần. Dự án lấy dữ liệu phim từ nhiều nguồn API phim Việt, bổ sung thông tin phim từ TMDB/OMDb, có player xem phim, chọn server, lịch sử xem và giao diện responsive.

## Tính năng chính

- Trang chủ có hero phim nổi bật, bộ lọc theo thể loại, quốc gia, loại phim và tìm kiếm.
- Có bảng xếp hạng gọn trên trang chủ: phim trending tuần từ TMDB, phim Hàn/Trung hot tuần từ TMDB, anime trending tuần và anime season từ AniList, có nút xem thêm.
- Hỗ trợ 3 nguồn phim: KKPhim, OPhim và NguonC.
- Tự động gộp phim trùng giữa nhiều server và lưu slug từng nguồn để chuyển server khi cần.
- Trang xem phim có player, chọn nguồn, chọn tập và nút chuyển tập tiếp theo.
- Hỗ trợ danh sách **Phim xem sau** và **Phim yêu thích**, lưu bằng `localStorage` và xuất/nhập cùng mọi dữ liệu DragonFilm.
- Hiển thị thông tin bổ sung từ TMDB, OMDb và AniList: điểm TMDB, điểm IMDb, điểm AniList, mô tả, thể loại, poster/backdrop, diễn viên và nhân vật/lồng tiếng anime.
- Lịch sử xem lưu trên thiết bị bằng `localStorage`, có xuất/nhập file JSON.
- Đăng nhập/đăng ký cục bộ bằng `localStorage`.
- Giao diện tối, responsive cho desktop và mobile.

## Nguồn dữ liệu

| Nguồn | Vai trò | API/Base URL |
| --- | --- | --- |
| Server 1 - KKPhim | Danh sách phim, tìm kiếm, chi tiết, tập phim | `https://phimapi.com` |
| Server 2 - OPhim | Danh sách phim, tìm kiếm, chi tiết, tập phim | `https://ophim1.com` |
| Server 3 - NguonC | Danh sách phim, tìm kiếm, chi tiết, tập phim | `https://phim.nguonc.com` |
| TMDB | Metadata phim, điểm TMDB, mô tả, thể loại, diễn viên | `https://api.themoviedb.org/3` |
| OMDb | Điểm IMDb và metadata phụ | `https://www.omdbapi.com` |
| AniList | Metadata anime, điểm AniList, studio, nhân vật và diễn viên lồng tiếng | `https://graphql.anilist.co` |

## Cấu trúc thư mục

```text
DragonFilm/
├── index.html          # Trang chủ, lọc phim, tìm kiếm, danh sách phim
├── movie.html          # Trang xem phim, player, chọn server/tập
├── history.html        # Lịch sử xem, xem sau, yêu thích, xuất/nhập mọi dữ liệu
├── assets/
│   └── logo.png        # Logo
├── css/
│   ├── style.css       # Style chung cho trang chủ, lịch sử, modal, responsive
│   └── player.css      # Style riêng cho trang xem phim/player
└── js/
    ├── api.js          # Layer gọi API phim, TMDB, OMDb, AniList, normalize dữ liệu
    ├── auth.js         # Auth localStorage, history, toast, menu
    ├── main.js         # Logic trang chủ, lọc, tìm kiếm, render card/hero
    ├── player.js       # Logic player, server/tập, lịch sử xem, next tập
    ├── history.js      # Logic lịch sử, xem sau, yêu thích, xuất/nhập mọi dữ liệu
    └── annouce.js      # Helper thông báo phụ, giữ tên cũ để tương thích
```

## Cách chạy local

Dự án không cần build. Có thể mở trực tiếp `index.html`, nhưng nên chạy bằng local server để tránh lỗi CORS hoặc đường dẫn tương đối trong một số trình duyệt.

Ví dụ với Python:

```bash
cd /path/to/dragonfilm-main
python3 -m http.server 8000
```

Sau đó mở:

```text
http://localhost:8000
```

## Deploy lên GitHub Pages

1. Tạo repository mới trên GitHub.
2. Upload toàn bộ file trong thư mục dự án.
3. Vào **Settings -> Pages**.
4. Chọn source là branch `main`, thư mục `/root` hoặc `/docs` tùy cách bạn upload.
5. Lưu lại và chờ GitHub Pages build xong.

Ví dụ URL sau khi deploy:

```text
https://username.github.io/repository-name/
```

## Cấu hình API key

API key đang được cấu hình trong [js/api.js](js/api.js):

- `API.tmdb.apiKey`: key TMDB.
- `API.omdb.apiKey`: key OMDb.
- AniList dùng GraphQL public endpoint cho dữ liệu anime, không cần API key với các truy vấn public hiện tại.

Vì đây là web tĩnh chạy hoàn toàn ở frontend, các key đặt trong JavaScript sẽ hiển thị công khai khi deploy. Nếu dùng production nghiêm túc, nên chuyển TMDB/OMDb request qua backend/proxy để bảo vệ key và gom cache metadata.

## Ghi chú khi xem phim

- Nếu phim bị giật, lag hoặc tải chậm, hãy đổi sang server khác.
- Nếu không xem được, có thể bật `1.1.1.1` / Cloudflare WARP hoặc VPN vì một số nhà mạng có thể chặn nguồn phát.
- Không phải phim nào cũng có đủ ở cả 3 server; trang xem phim sẽ tự disable server không có nguồn phát.
- Một số nguồn dùng iframe/player từ API, điều khiển phát sẽ phụ thuộc player bên trong iframe.

## LocalStorage

Dự án dùng `localStorage` để lưu:

- Server đang chọn: `dragonfilm_server`.
- Tài khoản local.
- Lịch sử xem.
- Thời gian xem dở.
- Phim xem sau.
- Phim yêu thích.
- Cache metadata OMDb/TMDB/AniList.

Dữ liệu này chỉ nằm trên trình duyệt/thiết bị hiện tại. Khi đổi thiết bị, dùng chức năng **Xuất mọi dữ liệu** và **Nhập mọi dữ liệu** trong `history.html`.

## Troubleshooting

**Không tải được danh sách phim**

- Kiểm tra kết nối mạng.
- Thử refresh trang.
- Một trong các API nguồn có thể đang lỗi tạm thời.

**Phim có nhưng không xem được**

- Đổi server ở phần **Nguồn Phim**.
- Thử tập khác nếu phim bộ.
- Bật `1.1.1.1` hoặc VPN.

**Không hiện điểm TMDB/IMDb/AniList hoặc diễn viên**

- TMDB/OMDb/AniList có thể không tìm được phim tương ứng theo tên/năm.
- API key có thể hết quota hoặc request bị chặn.
- Cache localStorage có thể cũ; thử xoá cache trình duyệt và tải lại.

## Ghi chú phát triển

- Đây là dự án frontend tĩnh, không có backend và không có bước build.
- Khi sửa CSS/JS, tăng query version trong HTML như `style.css?v=...` hoặc `main.js?v=...` để tránh cache trình duyệt.
- Khi thêm nguồn phim mới, cập nhật `API.servers` trong `js/api.js` và đảm bảo normalize dữ liệu về cùng format.
