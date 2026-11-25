import json, sys, urllib.request
def tts(vid, text, out, model="eleven_multilingual_v2", stab=0.35, sim=0.8, style=0.6, speed=None):
    vs={"stability":stab,"similarity_boost":sim,"style":style,"use_speaker_boost":True}
    if speed: vs["speed"]=speed
    body={"text":text,"model_id":model,"voice_settings":vs}
    req=urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_192",data=json.dumps(body).encode(),method="POST",
        headers={"xi-api-key":"proxy-injected","Content-Type":"application/json","Accept":"audio/mpeg"})
    with urllib.request.urlopen(req,timeout=180) as r: open(out,"wb").write(r.read())
    return len(text)
if __name__=="__main__":
    print(tts(sys.argv[1],sys.argv[2],sys.argv[3],*(sys.argv[4:5] or [])))
