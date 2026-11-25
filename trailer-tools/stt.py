import json, sys, subprocess, uuid, urllib.request
def stt(path):
    mp3 = path + ".stt.mp3"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "1", "-b:a", "64k", mp3], check=True)
    b = "----" + uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"model_id\"\r\n\r\nscribe_v1\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n").encode() + open(mp3, "rb").read() + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=body, method="POST",
        headers={"xi-api-key": "proxy-injected", "Content-Type": f"multipart/form-data; boundary={b}"})
    with urllib.request.urlopen(req, timeout=300) as r: return json.loads(r.read())
if __name__ == "__main__":
    for p in sys.argv[1:]:
        j = stt(p); json.dump(j, open(p + ".stt.json", "w"))
        print("==", p, "|", j["text"])
        print(" ".join(f"{w['text']}@{w['start']:.2f}-{w['end']:.2f}" for w in j["words"] if w.get("type") == "word"))
