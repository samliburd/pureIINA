import './sidebar.scss';
import React, { useState, useEffect, ChangeEvent, FocusEvent } from 'react';
import {
  IPCTimeUpdateMessage,
  IPCSyncStateMessage,
  IPCSetFilenameMessage,
  IPCCommandResultMessage,
  IPCFFMPEGProgressMessage,
  IPCSetCropStringMessage,
  IPCCropUpdateMessage,
} from '../../src/types';

const App = () => {
  const [startTime, setStartTime] = useState('00:00:00.000');
  const [endTime, setEndTime] = useState('-');
  const [filename, setFilename] = useState('');
  const [command, setCommand] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [resultMessage, setResultMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [useCrop, setUseCrop] = useState(false);
  const [showHud, setShowHud] = useState(false);
  const [cropString, setCropString] = useState('');
  const [ffmpegPath, setFFMPEGPath] = useState('');
  const [isFFMPEGPathFocused, setIsFFMPEGPathFocused] = useState(false);
  const [foundFFMPEGPaths, setFoundFFMPEGPaths] = useState<string[] | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [videoFrame, setVideoFrame] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);
  const [videoScale, setVideoScale] = useState<number>(1);

  useEffect(() => {
    if (window.iina) {
      window.iina.onMessage('time-update', (data: IPCTimeUpdateMessage) => {
        if (data.type === 'start') setStartTime(data.time);
        if (data.type === 'end') setEndTime(data.time);
      });
      window.iina.onMessage('sync-state', (data: IPCSyncStateMessage) => {
        setStartTime(data.startTime);
        setEndTime(data.endTime);
        setFilename(data.filename);
        setUseCrop(data.useCrop);
        setCropString(data.cropString);
        setShowHud(data.showHud);
        if (data.ffmpegPath) {
          setFFMPEGPath(data.ffmpegPath);
        }
      });
      window.iina.onMessage('ffmpeg-path-update', (data: { path: string | null }) => {
        setFFMPEGPath(data.path || '');
      });
      window.iina.onMessage('crop-update', (data: IPCCropUpdateMessage) => {
        if (data.cropBox) {
          const cropStr = `${data.cropBox.width}:${data.cropBox.height}:${data.cropBox.x}:${data.cropBox.y}`;
          setCropString(cropStr);
        }
      });
      window.iina.onMessage(
        'command-result',
        (data: IPCCommandResultMessage) => {
          setCommand(data.command);
        }
      );
      window.iina.onMessage(
        'ffmpeg-progress',
        (data: IPCFFMPEGProgressMessage) => {
          setProgress(data.progress);
          if (data.progress === 0) {
            setResultMessage(null);
          }
        }
      );
      window.iina.onMessage(
        'ffmpeg-result',
        (data: { message: string; error: boolean }) => {
          setResultMessage({ text: data.message, error: data.error });
        }
      );
      window.iina.onMessage(
        'video-update',
        (data: { videoWidth: number; videoHeight: number; videoFrame?: { x: number; y: number; width: number; height: number }; scale?: number }) => {
          if (data.videoWidth > 0 && data.videoHeight > 0) {
            setVideoDimensions({
              width: data.videoWidth,
              height: data.videoHeight,
            });
          }
          if (data.videoFrame) {
            setVideoFrame(data.videoFrame);
          }
          if (data.scale) {
            setVideoScale(data.scale);
          }
        }
      );

      window.iina.onMessage('ffmpeg-paths-found', (data: { paths: string[] }) => {
        setFoundFFMPEGPaths(data.paths);
      });

      window.iina.onMessage('ffmpeg-download-progress', (data: { status: string }) => {
        setDownloadProgress(data.status);
      });

      window.iina.postMessage('request-sync', {});
    }
  }, []);

  const handleSetStart = () => {
    if (window.iina) {
      window.iina.postMessage('set-start-time', {});
    }
  };

  const handleSetEnd = () => {
    if (window.iina) {
      window.iina.postMessage('set-end-time', {});
    }
  };

  const handleToggleCrop = () => {
    if (window.iina) {
      window.iina.postMessage('toggle-crop', {});
      setUseCrop(!useCrop);
    }
  };

  const handleCropChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCropString(e.target.value);
  };

  const handleCropBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (window.iina) {
      const payload: IPCSetCropStringMessage = { cropString: e.target.value };
      window.iina.postMessage('set-crop-string', payload);
    }
  };

  const handleFilenameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFilename(e.target.value);
  };

  const cropParts = cropString.split(':');
  const cropW = parseInt(cropParts[0]) || 0;
  const cropH = parseInt(cropParts[1]) || 0;
  const cropX = parseInt(cropParts[2]) || 0;
  const cropY = parseInt(cropParts[3]) || 0;

  const isCropValid = cropParts.length === 4 && cropW > 0 && cropH > 0;
  const maxCropX = videoDimensions
    ? Math.max(0, videoDimensions.width - cropW)
    : 0;
  const maxCropY = videoDimensions
    ? Math.max(0, videoDimensions.height - cropH)
    : 0;

  const handleSliderXChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newX = e.target.value;
    const newCropString = `${cropW}:${cropH}:${newX}:${cropY}`;
    setCropString(newCropString);
    if (window.iina) {
      const payload: IPCSetCropStringMessage = { cropString: newCropString };
      window.iina.postMessage('set-crop-string', payload);
    }
  };

  const handleSliderYChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newY = e.target.value;
    const newCropString = `${cropW}:${cropH}:${cropX}:${newY}`;
    setCropString(newCropString);
    if (window.iina) {
      const payload: IPCSetCropStringMessage = { cropString: newCropString };
      window.iina.postMessage('set-crop-string', payload);
    }
  };

  const handleFilenameBlur = (e: FocusEvent<HTMLInputElement>) => {
    let fn = e.target.value;
    if (fn && !fn.endsWith('.mp4')) {
      fn += '.mp4';
      setFilename(fn);
    }
    if (window.iina) {
      const payload: IPCSetFilenameMessage = { filename: fn };
      window.iina.postMessage('set-filename', payload);
    }
  };

  const handleSetOutputDir = () => {
    if (window.iina) {
      window.iina.postMessage('set-output-dir', {});
    }
  };

  const handleFFMPEGPathChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFFMPEGPath(e.target.value);
    setFoundFFMPEGPaths(null);
    setDownloadProgress(null);
  };

  const handleFFMPEGPathBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (window.iina) {
      window.iina.postMessage('set-ffmpeg-path', { path: e.target.value });
    }
  };

  const handleShowCommand = () => {
    if (window.iina) {
      window.iina.postMessage('get-command', {});
    }
  };

  const handleRunFFmpeg = () => {
    if (window.iina) {
      window.iina.postMessage('run-ffmpeg', {});
    }
  };

  return (
    <div className="sidebar-container">
      <h2>pureIINA</h2>
      <div className="time-controls">
        <div className="time-row">
          <button onClick={handleSetStart} className="action-btn start-end">
            Set Start
          </button>
          <span>{startTime}</span>
        </div>
        <div className="time-row">
          <button onClick={handleSetEnd} className="action-btn start-end">
            Set End
          </button>
          <span>{endTime}</span>
        </div>
      </div>

      <div className="input-group">
        <label>Output Filename</label>
        <input
          type="text"
          value={filename}
          onChange={handleFilenameChange}
          onBlur={handleFilenameBlur}
          className="text-input"
          placeholder="e.g. output.mp4"
        />
      </div>

      <div 
        className="input-group"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsFFMPEGPathFocused(false);
            setFoundFFMPEGPaths(null);
            setDownloadProgress(null);
          }
        }}
      >
        <label>FFmpeg Path</label>
        <input
          type="text"
          value={ffmpegPath}
          onChange={handleFFMPEGPathChange}
          onFocus={() => setIsFFMPEGPathFocused(true)}
          onBlur={handleFFMPEGPathBlur}
          className={`text-input ${ffmpegPath ? 'found' : ''}`}
          placeholder="/usr/local/bin/ffmpeg"
        />
        {isFFMPEGPathFocused && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              if (window.iina) {
                window.iina.postMessage('test-find-ffmpeg', {});
              }
            }}
            className="action-btn"
            style={{ marginTop: '8px' }}
          >
            Find ffmpeg
          </button>
        )}
        {foundFFMPEGPaths && (
          <div style={{ marginTop: '8px' }}>
            <textarea
              readOnly
              className="text-input"
              value={foundFFMPEGPaths.length > 0 ? foundFFMPEGPaths.join('\n') : 'No ffmpeg paths found.'}
              style={{ minHeight: '60px', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                if (window.iina) {
                  window.iina.postMessage('download-ffmpeg', {});
                }
              }}
              className="action-btn"
              style={{ marginTop: '8px', width: '100%' }}
            >
              Download ffmpeg
            </button>
            {downloadProgress && (
              <div style={{ marginTop: '8px', fontSize: '0.9em', color: 'var(--text-color)', textAlign: 'left' }}>
                {downloadProgress}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="button-group">
        <button
          onClick={handleToggleCrop}
          className={useCrop ? 'primary-btn' : 'action-btn'}
        >
          {useCrop ? 'Crop Mode: ON' : 'Crop Mode: OFF'}
        </button>
      </div>

      {useCrop && (
        <div className="input-group">
        <label>
          Crop (W:H:X:Y)
          {videoDimensions && (
            <span className="dim-text">
              {' '}
              {videoDimensions.width}x{videoDimensions.height}
            </span>
          )}
        </label>
        <input
          type="text"
          value={cropString}
          onChange={handleCropChange}
          onBlur={handleCropBlur}
          className="text-input"
          placeholder="e.g. 1280:720:0:0"
        />
        <div className="crop-sliders">
          <div className="slider-row">
            <span>X Offset</span>
            <input
              type="range"
              min="0"
              max={maxCropX}
              value={cropX}
              onChange={handleSliderXChange}
              disabled={!isCropValid || !videoDimensions}
              className="crop-slider"
            />
            <span className="slider-val">{cropX}</span>
          </div>
          <div className="slider-row">
            <span>Y Offset</span>
            <input
              type="range"
              min="0"
              max={maxCropY}
              value={cropY}
              onChange={handleSliderYChange}
              disabled={!isCropValid || !videoDimensions}
              className="crop-slider"
            />
            <span className="slider-val">{cropY}</span>
          </div>
        </div>
        </div>
      )}
      <div className="button-group">
        <div className="button-row">
          <button onClick={handleSetOutputDir} className="action-btn">
            Set Output Dir
          </button>
          <button onClick={handleShowCommand} className="action-btn">
            Show Command
          </button>
        </div>
        <button
          onClick={handleRunFFmpeg}
          className="primary-btn"
          disabled={progress !== null}
        >
          {progress !== null ? 'Running...' : 'Run FFmpeg'}
        </button>
      </div>

      {progress !== null && (
        <div className="progress-container">
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="progress-text">{progress.toFixed(1)}%</span>
        </div>
      )}

      {command && (
        <div className="command-display">
          <pre>{command}</pre>
        </div>
      )}

      {resultMessage && (
        <div
          className={`result-message ${resultMessage.error ? 'error' : 'success'}`}
        >
          {resultMessage.text}
        </div>
      )}

      {videoFrame && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '0.8em', color: 'var(--text-color)' }}>
          <strong>Debug: Window Frame</strong><br />
          x: {videoFrame.x}, y: {videoFrame.y}<br />
          width: {videoFrame.width}, height: {videoFrame.height}<br />
          scale: {videoScale.toFixed(2)}
        </div>
      )}
    </div>
  );
};

export default App;
