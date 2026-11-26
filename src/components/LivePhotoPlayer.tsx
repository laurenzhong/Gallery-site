import { CircleDot } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./livePhotoPlayer.css";

export function LivePhotoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const press = useRef<{ pointerId: number; startedAt: number } | null>(null);
  const held = useRef(false);
  const playback = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video?.hasAttribute("src")) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, []);

  const stop = () => {
    playback.current += 1;
    const video = videoRef.current;
    video?.pause();
    if (video?.readyState) video.currentTime = 0;
    setPlaying(false);
  };

  const play = (muted: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    const attempt = ++playback.current;
    setFailed(false);
    if (video.error) video.load();
    if (!video.hasAttribute("src")) video.src = src;
    if (video.readyState) video.currentTime = 0;
    video.muted = muted;
    void video.play().then(() => {
      if (playback.current === attempt) setPlaying(true);
    }).catch((error: unknown) => {
      if (playback.current !== attempt) return;
      setPlaying(false);
      // A tap can still start playback if the browser requires a completed gesture.
      if (!(muted && error instanceof DOMException && error.name === "NotAllowedError")) setFailed(true);
    });
  };

  return (
    <div className="live-photo-player">
      <video
        ref={videoRef}
        className={`live-photo-player-video${playing ? " is-playing" : ""}`}
        playsInline
        preload="none"
        aria-hidden="true"
        onEnded={stop}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
      <button
        type="button"
        className="live-photo-player-trigger"
        aria-label="Play Live Photo"
        title="Hold to preview, or tap to play with sound"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          press.current = { pointerId: event.pointerId, startedAt: event.timeStamp };
          held.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          play(event.pointerType !== "mouse");
        }}
        onPointerUp={(event) => {
          if (press.current?.pointerId !== event.pointerId) return;
          held.current = event.timeStamp - press.current.startedAt >= 260;
          press.current = null;
          if (held.current) stop();
        }}
        onLostPointerCapture={() => {
          if (!press.current) return;
          press.current = null;
          stop();
        }}
        onContextMenu={(event) => event.preventDefault()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (event.detail === 0 || !held.current) play(false);
          held.current = false;
        }}
      >
        <CircleDot size={16} aria-hidden="true" />
        Live
      </button>
      {failed && <span className="live-photo-player-status" role="status">Live Photo couldn’t play.</span>}
    </div>
  );
}
