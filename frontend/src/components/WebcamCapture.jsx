import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

const WebcamCapture = forwardRef(function WebcamCapture({ active = false, onFrame }, ref) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));

  useImperativeHandle(ref, () => ({
    captureFrame,
  }));

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (active) startCamera();
    else stopCamera();
    return stopCamera;
  }, [active]);

  const captureFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || video.readyState < 2) return null;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.7);
  }, []);

  return (
    <div className={`webcam-container ${active ? 'active' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxHeight: 360, objectFit: 'cover' }}
      />
      {!active && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', flexDirection: 'column', gap: 12,
        }}>
          <span style={{ fontSize: 40 }}>📷</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Camera inactive</span>
        </div>
      )}
    </div>
  );
});

export default WebcamCapture;
