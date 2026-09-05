"use client";

import { useEffect, useRef, useState } from "react";

interface AmbientVideoBackgroundProps {
  videoSrc?: string;
  posterSrc?: string;
}

export function AmbientVideoBackground({
  videoSrc = "/videos/ambient-server.mp4",
  posterSrc = "https://images.unsplash.com/photo-1545665277-5937489579f2?auto=format&fit=crop&w=1800&q=82",
}: AmbientVideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    // The native "loadeddata" event can fire before React finishes hydrating and
    // attaches its listener (especially with SSR + autoplay), so also poll readyState.
    if (video.readyState >= 2) setIsVideoLoaded(true);

    video.playbackRate = 0.72;
    const attemptPlay = () => video.play().catch(() => {});
    attemptPlay();

    const handleVisibility = () => {
      if (document.hidden) video.pause();
      else attemptPlay();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return (
    <div className="ambient-video-bg" aria-hidden="true">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        poster={posterSrc}
        onLoadedData={() => setIsVideoLoaded(true)}
        className="ambient-video-bg-el"
        style={{ opacity: isVideoLoaded ? 1 : 0 }}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
      <div className="ambient-video-grid" />
      <div className="ambient-video-vignette" />
    </div>
  );
}
