import CodeBlock from "../components/CodeBlock";
import Endpoint from "../components/Endpoint";

const P = ({ children }) => <p className="text-sm leading-relaxed text-on-surface-variant">{children}</p>;
const Code = ({ children }) => (
  <code className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[0.85em] text-on-surface">
    {children}
  </code>
);

export default function Docs() {
  // Reflects wherever this page is actually being viewed from (localhost
  // during dev, the real host:port once deployed) instead of a guessed
  // placeholder — this server itself speaks plain HTTP; if https:// shows
  // up here it's because a TLS-terminating reverse proxy sits in front.
  const origin = window.location.origin;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Referensi</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-on-surface">Dokumentasi API</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
        Semua endpoint di bawah ini satu origin dengan server ini (tidak ada base URL terpisah). Setiap request
        diautentikasi lewat API key — buat key-nya di halaman{" "}
        <a href="#/" className="font-medium text-primary hover:underline">
          Akun
        </a>{" "}
        setelah login. Contoh di bawah pakai <Code>{origin}</Code> — alamat tempat halaman ini sendiri dibuka;
        server ini jalan HTTP biasa kecuali ada reverse proxy TLS di depannya.
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface">Autentikasi</h2>
          <div className="mt-3 space-y-3">
            <P>
              Kirim API key lewat header <Code>Authorization: Bearer &lt;key&gt;</Code> di setiap request. Key
              mewakili satu akun Claude yang sudah login di halaman Akun — semua request dengan key itu berjalan
              atas nama akun tersebut, terisolasi penuh dari akun lain (kredensial, riwayat percakapan, semuanya
              terpisah).
            </P>
            <P>
              Key yang salah/sudah dicabut akan ditolak dengan <Code>401</Code>. Tanpa header <Code>Authorization</Code>{" "}
              sama sekali, request dianggap datang dari browser biasa (pakai cookie sesi) — ini hanya relevan untuk
              UI ini sendiri, bukan untuk pemanggilan API dari luar.
            </P>
            <CodeBlock
              label="Contoh header"
              code={`Authorization: Bearer csk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
            />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface">Mengobrol dengan Claude</h2>
          <div className="mt-3">
            <Endpoint method="POST" path="/ask">
              <P>
                Kirim satu pertanyaan, dapat satu jawaban. Sesi ini murni percakapan teks — tanpa akses tool, file,
                atau eksekusi kode apa pun di sisi Claude (dikunci lewat <Code>--tools ""</Code> dan{" "}
                <Code>--strict-mcp-config</Code> di server).
              </P>

              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Body
                </div>
                <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
                  <li>
                    <Code>prompt</Code> <span className="text-xs">(string, wajib)</span> — pertanyaan/instruksinya.
                  </li>
                  <li>
                    <Code>sessionId</Code> <span className="text-xs">(string, opsional)</span> — <Code>session_id</Code>{" "}
                    dari respons sebelumnya, kirim balik untuk melanjutkan percakapan yang sama (multi-turn).
                  </li>
                </ul>
              </div>

              <CodeBlock
                label="Request"
                code={`curl -X POST ${origin}/ask \\
  -H "Authorization: Bearer csk_xxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Sebutkan 1 fakta singkat tentang Indonesia."}'`}
              />

              <CodeBlock
                label="Response 200"
                code={`{
  "result": "Indonesia adalah negara kepulauan terbesar di dunia...",
  "session_id": "a8157afe-ad41-4273-aaa5-c0d442136ad7",
  "total_cost_usd": 0.0022,
  "usage": { "input_tokens": 212, "output_tokens": 69 }
}`}
              />

              <CodeBlock label="Response 4xx/5xx" code={`{ "error": "Field 'prompt' (string) is required" }`} />
            </Endpoint>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface">Status akun</h2>
          <div className="mt-3 space-y-4">
            <Endpoint method="GET" path="/auth/status">
              <P>Status login akun yang direpresentasikan oleh API key ini.</P>
              <CodeBlock
                label="Response 200"
                code={`{
  "loggedIn": true,
  "authMethod": "claude.ai",
  "email": "nama@gameloft.com",
  "orgName": "Gameloft SE D",
  "subscriptionType": "team"
}`}
              />
            </Endpoint>

            <Endpoint method="POST" path="/auth/logout">
              <P>
                Logout akun Claude yang terhubung ke sesi/API key ini. Ini <strong>tidak</strong> mencabut API
                key-nya sendiri — key tetap ada, cuma akun Claude di baliknya jadi belum-login sampai login ulang
                lewat halaman Akun.
              </P>
              <CodeBlock label="Response 200" code={`{ "ok": true, "output": "Successfully logged out..." }`} />
            </Endpoint>

            <Endpoint method="GET" path="/whoami">
              <P>ID sesi internal yang direpresentasikan oleh API key/cookie ini. Berguna untuk debugging.</P>
              <CodeBlock label="Response 200" code={`{ "uid": "b879026b-a18d-4cbd-bbbf-729daa6dbae0" }`} />
            </Endpoint>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface">Kelola API key</h2>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Bisa dikelola dari halaman Akun, atau lewat API langsung (misal untuk otomasi rotasi key).
          </p>
          <div className="mt-3 space-y-4">
            <Endpoint method="GET" path="/auth/api-keys">
              <P>Daftar API key milik akun ini. Nilai key mentah tidak pernah dikembalikan lagi setelah dibuat.</P>
              <CodeBlock
                label="Response 200"
                code={`{
  "rows": [
    {
      "id": "3406ebd1-22f3-41a0-8df0-2b3dd68a52bb",
      "name": "script-backup",
      "key_prefix": "csk_-1AOM2",
      "created_at": "2026-08-27T15:21:36.000Z",
      "last_used_at": "2026-08-27T15:21:48.000Z"
    }
  ]
}`}
              />
            </Endpoint>

            <Endpoint method="POST" path="/auth/api-keys">
              <P>
                Buat API key baru untuk akun ini. Nilai <Code>key</Code> di respons hanya muncul sekali ini saja —
                simpan segera.
              </P>
              <CodeBlock label="Request" code={`{ "name": "script-backup" }`} />
              <CodeBlock
                label="Response 200"
                code={`{
  "id": "3406ebd1-22f3-41a0-8df0-2b3dd68a52bb",
  "name": "script-backup",
  "key": "csk_-1AOM2lMq8lpZshq_qAJH35Le0vbBysdvi7rdVXdpVY",
  "prefix": "csk_-1AOM2"
}`}
              />
            </Endpoint>

            <Endpoint method="DELETE" path="/auth/api-keys/:id">
              <P>Cabut satu API key. Efeknya langsung — request berikutnya dengan key itu ditolak 401.</P>
              <CodeBlock label="Response 200" code={`{ "ok": true }`} />
              <CodeBlock label="Response 404" code={`{ "error": "Key tidak ditemukan" }`} />
            </Endpoint>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-on-surface">Catatan</h2>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-on-surface-variant">
            <li>Login akun baru (browser + kode OAuth) hanya bisa dilakukan lewat halaman Akun, bukan lewat API.</li>
            <li>
              Setiap akun butuh subscription Claude Pro/Max/Team aktif — akun gratisan tidak bisa login lewat
              server ini.
            </li>
            <li>Satu akun bisa punya banyak API key sekaligus, masing-masing bisa dicabut sendiri-sendiri.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
