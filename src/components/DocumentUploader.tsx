import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Camera, RotateCcw, Check, X, Image as ImageIcon } from 'lucide-react';

interface DocumentUploaderProps {
  onUpload: (file: File) => Promise<void>;
  isProcessing: boolean;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onUpload, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const validateFile = (file: File): string | null => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    if (!allowedTypes.includes(file.type)) {
      return 'Only JPEG, PNG, WebP, and HEIC files are supported';
    }

    return null;
  };

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
    } catch (err) {
      setError('Unable to access camera. Please check permissions and try again.');
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
    setCapturedImage(null);
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    if (cameraActive) {
      stopCamera();
      // Small delay to ensure camera is properly released
      setTimeout(() => {
        startCamera();
      }, 100);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob and create image URL
    canvas.toBlob((blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
      }
    }, 'image/jpeg', 0.9);
  };

  const confirmCapture = async () => {
    if (!capturedImage || !canvasRef.current) return;

    canvasRef.current.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `captured-${Date.now()}.jpg`, { type: 'image/jpeg' });
        await handleFile(file);
        stopCamera();
        setMode('upload');
      }
    }, 'image/jpeg', 0.9);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
  };

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await onUpload(file);
    } catch (err) {
      setError('Failed to process document. Please try again.');
    }
  }, [onUpload]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  useEffect(() => {
    return () => {
      // Cleanup camera stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
    };
  }, [stream, capturedImage]);

  useEffect(() => {
    if (mode === 'upload') {
      stopCamera();
    }
  }, [mode]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Mode Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-center">
          <div className="bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            <button
              onClick={() => setMode('upload')}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                mode === 'upload'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
              disabled={isProcessing}
            >
              <Upload className="w-5 h-5" />
              <span>Upload Mode</span>
            </button>
            <button
              onClick={() => setMode('camera')}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                mode === 'camera'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
              disabled={isProcessing}
            >
              <Camera className="w-5 h-5" />
              <span>Camera Mode</span>
            </button>
          </div>
        </div>
      </div>

      {mode === 'upload' ? (
        /* Upload Mode */
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleChange}
            accept=".jpg,.jpeg,.png,.webp,.heic"
            disabled={isProcessing}
          />
          
          <div className="space-y-4">
            <div className="flex justify-center">
              {dragActive ? (
                <FileText className="w-16 h-16 text-blue-500" />
              ) : (
                <ImageIcon className="w-16 h-16 text-gray-400" />
              )}
            </div>
            
            <div>
              <p className="text-xl font-semibold text-gray-700 mb-2">
                {dragActive ? 'Drop your document here' : 'Upload Document for Validation'}
              </p>
              <p className="text-gray-500 mb-4">
                Drag and drop or click to select • JPEG, PNG, WebP, HEIC • Max 10MB
              </p>
              <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium mb-2">📋 Requirements:</h4>
                <ul className="text-left space-y-1">
                  <li>• Image must be clear and well-lit</li>
                  <li>• No blurry or distorted images</li>
                  <li>• Ensure all text is readable</li>
                  <li>• Document should fill most of the frame</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
              disabled={isProcessing}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <Upload className="w-5 h-5 mr-2" />
              Choose File
            </button>
          </div>
        </div>
      ) : (
        /* Camera Mode */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">📸 Camera Capture</h3>
              <p className="text-gray-600">Take a photo of your document</p>
            </div>

            {!cameraActive && !capturedImage && (
              <div className="text-center space-y-4">
                <div className="bg-gray-50 rounded-lg p-8">
                  <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <div className="text-sm text-gray-600 mb-6">
                    <h4 className="font-medium mb-3"> Camera Guidelines:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">✅ Do:</h5>
                        <ul className="space-y-1">
                          <li>• Ensure good lighting</li>
                          <li>• Hold device steady</li>
                          <li>• Fill frame with document</li>
                          <li>• Keep document flat</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">❌ Avoid:</h5>
                        <ul className="space-y-1">
                          <li>• Blurry or shaky images</li>
                          <li>• Poor lighting/shadows</li>
                          <li>• Tilted or angled shots</li>
                          <li>• Partial document capture</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={startCamera}
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                    disabled={isProcessing}
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Start Camera
                  </button>
                </div>
              </div>
            )}

            {cameraActive && !capturedImage && (
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-96 object-cover"
                  />
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={switchCamera}
                      className="p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-all duration-200"
                      title="Switch Camera"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                    <button
                      onClick={capturePhoto}
                      className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-blue-500 transition-all duration-200 flex items-center justify-center"
                    >
                      <div className="w-12 h-12 bg-blue-500 rounded-full"></div>
                    </button>
                  </div>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="space-y-4">
                <div className="relative">
                  <img
                    src={capturedImage}
                    alt="Captured document"
                    className="w-full h-96 object-cover rounded-lg"
                  />
                </div>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={retakePhoto}
                    className="flex items-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Retake
                  </button>
                  <button
                    onClick={confirmCapture}
                    className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
                    disabled={isProcessing}
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Use Photo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
          <p className="text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
};