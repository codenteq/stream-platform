#!/usr/bin/env bash
# API negatif/kötü senaryo testleri: kimlik doğrulama, yetki, kullanıcı izolasyonu,
# girdi doğrulama ve herkese açık uçlar. Çalışan bir API'ye HTTP ile istek atar.
#
# Kullanım:
#   API_URL=http://localhost:8000/api JWT_SECRET=dev-secret bash scripts/api-negative-tests.sh
#
# JWT_SECRET yalnızca imzalı token testleri için gerekir; verilmezse bu testler atlanır ve
# özette "atlandi" olarak gösterilir. Gereksinimler: curl ve python3 (ek paket gerekmez).
set -u
B="${API_URL:-http://localhost:8000/api}"
SECRET="${JWT_SECRET:-}"
J='Content-Type: application/json'
pass=0; fail=0; skip=0

check() {
  if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  \033[32mPASS\033[0m %s (%s)\n' "$1" "$3"
  else fail=$((fail+1)); printf '  \033[31mFAIL\033[0m %s: beklenen %s, gelen %s\n' "$1" "$2" "$3"; fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
body() { curl -s "$@"; }
# HS256 token üretir; yalnızca Python standart kütüphanesini kullanır.
# $1: şu andan itibaren geçerlilik süresi (saniye, eksi olabilir), $2: imza anahtarı
jwt() {
  python3 - "$1" "$2" <<'PY'
import base64, hashlib, hmac, json, sys, time
def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
claims = b64(json.dumps({"user_id": 1, "exp": int(time.time()) + int(sys.argv[1])}).encode())
sig = hmac.new(sys.argv[2].encode(), f"{head}.{claims}".encode(), hashlib.sha256).digest()
print(f"{head}.{claims}.{b64(sig)}")
PY
}

rand=$RANDOM
curl -s -XPOST $B/register -H "$J" -d "{\"name\":\"Owner\",\"email\":\"owner$rand@x.com\",\"password\":\"secret123\"}" >/dev/null
curl -s -XPOST $B/register -H "$J" -d "{\"name\":\"Intruder\",\"email\":\"intruder$rand@x.com\",\"password\":\"secret123\"}" >/dev/null
TA=$(body -XPOST $B/login -H "$J" -d "{\"email\":\"owner$rand@x.com\",\"password\":\"secret123\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
TB=$(body -XPOST $B/login -H "$J" -d "{\"email\":\"intruder$rand@x.com\",\"password\":\"secret123\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
HA="Authorization: Bearer $TA"; HB="Authorization: Bearer $TB"
BID=$(body -XPOST $B/broadcasts -H "$HA" -H "$J" -d '{"title":"Owner yayini"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
CODE=$(body $B/broadcasts -H "$HA" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["studio_code"])')
DID=$(body -XPOST $B/destinations -H "$HA" -H "$J" -d '{"platform":"YouTube","rtmp_url":"rtmp://a.rtmp.youtube.com/live2","stream_key":"key-123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

echo "== 1. Kimlik dogrulama =="
check "token yok" 401 "$(code $B/broadcasts)"
check "bozuk token" 401 "$(code $B/broadcasts -H 'Authorization: Bearer not.a.jwt')"
check "bos Bearer" 401 "$(code $B/broadcasts -H 'Authorization: Bearer ')"
if [ -n "$SECRET" ]; then
  # Kontrol: doğru imzalı token kabul edilmeli. Bu geçmezse aşağıdaki 401'ler de anlamsızdır.
  check "gecerli token kabul edildi (kontrol)" 200 "$(code $B/broadcasts -H "Authorization: Bearer $(jwt 99 "$SECRET")")"
  check "yanlis imzali token" 401 "$(code $B/broadcasts -H "Authorization: Bearer $(jwt 99 wrong-secret)")"
  check "suresi gecmis token" 401 "$(code $B/broadcasts -H "Authorization: Bearer $(jwt -10 "$SECRET")")"
else
  skip=$((skip+3)); printf '  \033[33mATLANDI\033[0m imzali token testleri (3): JWT_SECRET verilmedi\n'
fi

echo "== 2. Kayit/giris dogrulama =="
check "kisa sifre" 400 "$(code -XPOST $B/register -H "$J" -d "{\"email\":\"a$rand@x.com\",\"password\":\"12\"}")"
check "bos e-posta" 400 "$(code -XPOST $B/register -H "$J" -d '{"email":"  ","password":"secret123"}')"
check "yinelenen e-posta" 409 "$(code -XPOST $B/register -H "$J" -d "{\"email\":\"owner$rand@x.com\",\"password\":\"secret123\"}")"
check "yanlis sifre" 401 "$(code -XPOST $B/login -H "$J" -d "{\"email\":\"owner$rand@x.com\",\"password\":\"wrong\"}")"
check "olmayan kullanici" 401 "$(code -XPOST $B/login -H "$J" -d '{"email":"ghost@x.com","password":"secret123"}')"
check "bozuk JSON" 400 "$(code -XPOST $B/login -H "$J" -d '{not json')"

echo "== 3. Yetki (sahiplik) =="
check "baskasinin yayinini duzenleme" 403 "$(code -XPUT $B/broadcasts/$BID -H "$HB" -H "$J" -d '{"title":"x"}')"
check "baskasinin yayinini silme" 403 "$(code -XDELETE $B/broadcasts/$BID -H "$HB")"
check "baskasinin studyosuna host token" 403 "$(code -XPOST $B/livekit/token -H "$HB" -H "$J" -d "{\"room\":\"$CODE\"}")"
check "baskasinin yayininda egress baslatma" 403 "$(code -XPOST $B/broadcasts/studio/$CODE/start-egress -H "$HB" -H "$J" -d '{}')"
check "baskasinin yayininda egress durdurma" 403 "$(code -XPOST $B/broadcasts/studio/$CODE/stop-egress -H "$HB")"
check "baskasinin yayinina hedef ekleme" 404 "$(code -XPOST $B/broadcasts/$BID/targets -H "$HB" -H "$J" -d '{"platform":"X","rtmp_url":"rtmp://x","stream_key":"k"}')"

echo "== 4. Kullanici izolasyonu =="
check "B, A'nin yayinlarini gormuyor" 0 "$(body $B/broadcasts -H "$HB" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
check "B, A'nin hedeflerini gormuyor" 0 "$(body $B/destinations -H "$HB" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
check "B, A'nin hedefini silemiyor" 404 "$(code -XDELETE $B/destinations/$DID -H "$HB")"
check "B, A'nin studio_code'una erisemiyor" 404 "$(code $B/broadcasts/studio/$CODE -H "$HB")"

echo "== 5. Girdi dogrulama =="
check "SQLi (zaman tabanli) engellendi" 400 "$(code -XPUT "$B/broadcasts/(id=1)AND(pg_sleep(2)::text='')" -H "$HA" -H "$J" -d '{"description":"x"}')"
check "sayisal olmayan id" 400 "$(code -XDELETE $B/broadcasts/abc -H "$HA")"
check "sifir id" 400 "$(code -XDELETE $B/broadcasts/0 -H "$HA")"
check "olmayan yayin id" 404 "$(code -XDELETE $B/broadcasts/999999 -H "$HA")"
check "basliksiz yayin" 400 "$(code -XPOST $B/broadcasts -H "$HA" -H "$J" -d '{"description":"x"}')"
check "bos baslik" 400 "$(code -XPOST $B/broadcasts -H "$HA" -H "$J" -d '{"title":"   "}')"
check "http RTMP reddedildi" 400 "$(code -XPOST $B/destinations -H "$HA" -H "$J" -d '{"platform":"X","rtmp_url":"http://evil","stream_key":"k"}')"
check "bos stream key reddedildi" 400 "$(code -XPOST $B/destinations -H "$HA" -H "$J" -d '{"platform":"X","rtmp_url":"rtmp://a","stream_key":""}')"
check "platformsuz hedef reddedildi" 400 "$(code -XPOST $B/destinations -H "$HA" -H "$J" -d '{"rtmp_url":"rtmp://a","stream_key":"k"}')"

echo "== 6. Herkese acik uclar =="
check "olmayan studyo bilgisi" 404 "$(code $B/public/studio/does-not-exist)"
check "isimsiz misafir girisi" 400 "$(code -XPOST $B/public/join-studio -H "$J" -d "{\"studioCode\":\"$CODE\",\"name\":\"   \"}")"
check "olmayan studyoya misafir girisi" 404 "$(code -XPOST $B/public/join-studio -H "$J" -d '{"studioCode":"nope","name":"Ali"}')"

echo
printf 'Toplam: \033[32m%d gecti\033[0m, \033[31m%d basarisiz\033[0m' "$pass" "$fail"
[ "$skip" -gt 0 ] && printf ', \033[33m%d atlandi\033[0m' "$skip"
echo
[ "$fail" -eq 0 ]
