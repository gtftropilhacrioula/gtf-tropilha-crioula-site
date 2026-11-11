#!/usr/bin/env python3
"""Baixa fotos listadas em fotos-pendentes.json, converte para WebP e envia ao Monday.

Roda no build do Render. Nunca derruba o deploy: sempre termina com código 0 e
grava o resultado em status-fotos.json (publicado junto com o site, sem segredos).
Requer a variável de ambiente MONDAY_TOKEN e o pacote Pillow.
"""
import io, json, os, sys, time, uuid, urllib.request, urllib.parse, urllib.error

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFESTO = os.path.join(RAIZ, "fotos-pendentes.json")
STATUS = os.path.join(RAIZ, "status-fotos.json")
API = "https://api.monday.com/v2"
COL_MINIATURA = "file_mm9035nx"
COL_FOTOS = "file_mm903rjz"
HOSTS_OK = (".fbcdn.net", ".facebook.com", ".fbsbx.com", ".cdninstagram.com")
MAX_LADO = 1600
UA = "Mozilla/5.0 (compatible; GTFTropilhaBuild/1.0)"


def agora():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def url_ok(u):
    p = urllib.parse.urlparse(u)
    return p.scheme == "https" and any((p.hostname or "").endswith(h) for h in HOSTS_OK)


def baixar(u):
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        dados = r.read(25_000_000)
    return dados


def para_webp(dados):
    from PIL import Image, ImageOps
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(dados))).convert("RGB")
    im.thumbnail((MAX_LADO, MAX_LADO))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=80, method=6)
    return buf.getvalue()


def gql(token, query, variaveis=None):
    corpo = json.dumps({"query": query, "variables": variaveis or {}}).encode()
    req = urllib.request.Request(API, data=corpo, headers={"Authorization": token, "Content-Type": "application/json", "API-Version": "2024-10"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read())


def nomes_existentes(token, item_id, col):
    r = gql(token, "query($i:[ID!]){items(ids:$i){column_values(ids:[\"%s\"]){value}}}" % col, {"i": [str(item_id)]})
    try:
        v = r["data"]["items"][0]["column_values"][0]["value"]
        return {f.get("name") for f in (json.loads(v) or {}).get("files", [])} if v else set()
    except Exception:
        return set()


def enviar(token, item_id, col, nome, dados):
    lim = "----gtf" + uuid.uuid4().hex
    q = 'mutation($file: File!){add_file_to_column(item_id: %d, column_id: "%s", file: $file){id}}' % (int(item_id), col)
    partes = [
        ("--%s\r\nContent-Disposition: form-data; name=\"query\"\r\n\r\n%s\r\n" % (lim, q)).encode(),
        ("--%s\r\nContent-Disposition: form-data; name=\"variables[file]\"; filename=\"%s\"\r\nContent-Type: image/webp\r\n\r\n" % (lim, nome)).encode(),
        dados,
        ("\r\n--%s--\r\n" % lim).encode(),
    ]
    req = urllib.request.Request(API + "/file", data=b"".join(partes), headers={"Authorization": token, "API-Version": "2024-10", "Content-Type": "multipart/form-data; boundary=" + lim})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.loads(r.read())
    if resp.get("errors"):
        raise RuntimeError(str(resp["errors"])[:300])


def processar():
    st = {"quando": agora(), "itens": [], "erros": []}
    token = os.environ.get("MONDAY_TOKEN", "").strip()
    if not token:
        st["erros"].append("MONDAY_TOKEN não configurado")
        return st
    if not os.path.exists(MANIFESTO):
        st["aviso"] = "sem fotos-pendentes.json"
        return st
    try:
        quem = gql(token, "query{me{id}}")
        st["monday"] = "ok" if quem.get("data", {}).get("me") else "token recusado"
    except Exception as e:
        st["monday"] = "falha: " + str(e)[:120]
    manifesto = json.load(open(MANIFESTO, encoding="utf-8"))
    for it in manifesto.get("itens", []):
        iid = it["item_id"]
        res = {"item_id": iid, "enviadas": [], "puladas": [], "falhas": []}
        alvo = [(COL_MINIATURA, "miniatura", [it["miniatura"]] if it.get("miniatura") else []), (COL_FOTOS, "foto", it.get("fotos", []))]
        for col, rot, urls in alvo:
            ja = nomes_existentes(token, iid, col)
            for n, u in enumerate(urls, 1):
                nome = f"evento-{iid}-{rot}-{n}.webp"
                if nome in ja:
                    res["puladas"].append(nome)
                    continue
                try:
                    if not url_ok(u):
                        raise ValueError("endereço não permitido")
                    enviar(token, iid, col, nome, para_webp(baixar(u)))
                    res["enviadas"].append(nome)
                except Exception as e:
                    res["falhas"].append({"arquivo": nome, "erro": str(e)[:200]})
        st["itens"].append(res)
    return st


if __name__ == "__main__":
    try:
        resultado = processar()
    except Exception as e:  # nunca derruba o deploy
        resultado = {"quando": agora(), "itens": [], "erros": [str(e)[:300]]}
    with open(STATUS, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=1)
    print("fotos_para_monday:", json.dumps(resultado, ensure_ascii=False)[:800])
    sys.exit(0)
