import { PHOTO_SIZE_PX } from "@mafija/shared";

/**
 * Snima jednu sliku sa kamere — NEZAVISNO od LiveKit-a (obican
 * getUserMedia + canvas). Kratko trazi kameru, uzme jedan frejm, odmah
 * pusti stream — ne zavisi od pravila "kamera samo tokom diskusije" jer
 * se ne objavljuje nigde, samo se salje serveru kao slika.
 */
export async function captureSelfie(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await waitForFrame(video);

    const size = PHOTO_SIZE_PX;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;

    // Ogledalo (kao pravi selfie) — prirodnije nego neogledani snimak.
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);

    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

function waitForFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if (video.videoWidth > 0) {
      resolve();
      return;
    }
    const onLoaded = () => {
      video.removeEventListener("loadeddata", onLoaded);
      resolve();
    };
    video.addEventListener("loadeddata", onLoaded);
    setTimeout(resolve, 1500); // ne cekamo unedogled ako event ne stigne
  });
}
