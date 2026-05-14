# DragonFilm

**DragonFilm** là website xem phim online dạng static web app, chạy trực tiếp bằng HTML, CSS và JavaScript thuần. Dự án lấy dữ liệu phim từ nhiều nguồn API phim Việt, bổ sung thông tin phim từ TMDB/OMDb, có player xem phim, chọn server, lịch sử xem và giao diện responsive.

## Tính năng chính

- Trang chủ có hero phim nổi bật, bộ lọc theo thể loại, quốc gia, loại phim và tìm kiếm.
- Có bảng xếp hạng gọn trên trang chủ: phim trending tuần từ TMDB, phim Hàn/Trung hot tuần từ TMDB, anime trending tuần và anime season từ AniList, có nút xem thêm.
- Hỗ trợ 3 nguồn phim: KKPhim, OPhim và NguonC.
- Tự động gộp phim trùng giữa nhiều server và lưu slug từng nguồn để chuyển server khi cần.
- Trang xem phim có player, chọn nguồn, chọn tập và nút chuyển tập tiếp theo.
- Hỗ trợ danh sách **Phim xem sau** và **Phim yêu thích**, lưu cục bộ và tự đồng bộ Supabase khi người dùng đăng nhập.
- Hiển thị thông tin bổ sung từ TMDB, OMDb và AniList: điểm TMDB, điểm IMDb, điểm AniList, mô tả, thể loại, poster/backdrop, diễn viên và nhân vật/lồng tiếng anime.
- Lịch sử xem lưu trên thiết bị bằng `localStorage`, đồng bộ Supabase qua Cloudflare Pages Functions khi đăng nhập, có xuất/nhập file JSON.
- Đăng nhập/đăng ký qua Cloudflare Pages Functions, mật khẩu được hash trước khi lưu trong Supabase.
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
├── functions/          # Cloudflare Pages Functions cho auth và đồng bộ dữ liệu người dùng
├── index.html          # Trang chủ, lọc phim, tìm kiếm, danh sách phim
├── movie.html          # Trang xem phim, player, chọn server/tập
├── history.html        # Lịch sử xem, xem sau, yêu thích, xuất/nhập mọi dữ liệu
├── assets/
│   └── logo.png        # Logo
├── css/
│   ├── style.css       # Style chung cho trang chủ, lịch sử, modal, responsive
│   └── player.css      # Style riêng cho trang xem phim/player
├── supabase/
│   └── schema.sql      # Bảng Supabase cho tài khoản và dữ liệu người dùng
├── .dev.vars.example   # Biến môi trường mẫu khi chạy Cloudflare local
├── .env.example        # Biến môi trường mẫu
├── _routes.json        # Chỉ invoke Pages Functions cho /api/*
├── package.json        # Script chạy Wrangler Pages dev/deploy
└── js/
    ├── api.js          # Layer gọi API phim, TMDB, OMDb, AniList, normalize dữ liệu
    ├── auth.js         # Auth, đồng bộ Supabase, history, toast, menu
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

Nếu muốn chạy cả Cloudflare Pages Functions ở local, cài Wrangler rồi chạy:

```bash
cp .dev.vars.example .dev.vars
npx wrangler pages dev .
```

## Dùng Cloudflare + Supabase để lưu dữ liệu người dùng

1. Tạo project Supabase.
2. Mở **SQL Editor** trong Supabase và chạy toàn bộ file [supabase/schema.sql](supabase/schema.sql).
3. Deploy project lên Cloudflare Pages.
4. Trong **Cloudflare Workers & Pages -> project -> Settings -> Variables and Secrets**, thêm:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DRAGONFILM_JWT_SECRET=mot-chuoi-bi-mat-dai-it-nhat-24-ky-tu
```

Nên lưu `SUPABASE_SERVICE_ROLE_KEY` và `DRAGONFILM_JWT_SECRET` dạng secret/encrypted. Không đưa các key này vào JavaScript frontend.

Các API serverless đã có sẵn:

| Endpoint | Vai trò |
| --- | --- |
| `POST /api/auth/register` | Tạo tài khoản, hash mật khẩu và lưu vào Supabase |
| `POST /api/auth/login` | Đăng nhập và trả token phiên |
| `GET /api/user-data` | Lấy lịch sử/xem sau/yêu thích của người dùng |
| `POST /api/user-data` | Đồng bộ dữ liệu người dùng lên Supabase |

Frontend vẫn giữ `localStorage` làm cache nhanh. Sau khi đăng nhập, dữ liệu cục bộ sẽ được merge với dữ liệu trên Supabase rồi tự đồng bộ lại.

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

Dự án dùng `localStorage` làm cache cục bộ để lưu:

- Server đang chọn: `dragonfilm_server`.
- Phiên đăng nhập hiện tại.
- Lịch sử xem.
- Thời gian xem dở.
- Phim xem sau.
- Phim yêu thích.
- Cache metadata OMDb/TMDB/AniList.

Khi deploy với Cloudflare + Supabase, lịch sử xem, thời gian xem dở, phim xem sau và phim yêu thích sẽ đồng bộ theo tài khoản. Chức năng **Xuất mọi dữ liệu** và **Nhập mọi dữ liệu** vẫn giữ lại để sao lưu hoặc nhập dữ liệu cũ.

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

- Phần frontend vẫn là static web app; backend nhẹ nằm trong thư mục `functions/` và chạy bằng Cloudflare Pages Functions.
- Khi sửa CSS/JS, tăng query version trong HTML như `style.css?v=...` hoặc `main.js?v=...` để tránh cache trình duyệt.
- Khi thêm nguồn phim mới, cập nhật `API.servers` trong `js/api.js` và đảm bảo normalize dữ liệu về cùng format.
