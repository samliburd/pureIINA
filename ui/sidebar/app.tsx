import './sidebar.scss';
import React, { useState, useEffect, ChangeEvent, FocusEvent } from 'react';
import {
  IPCTimeUpdateMessage,
  IPCSyncStateMessage,
  IPCSetFilenameMessage,
  IPCCommandResultMessage,
  IPCFFMPEGProgressMessage,
} from '../../src/types';

const App = () => {
  const [startTime, setStartTime] = useState('00:00:00.000');
  const [endTime, setEndTime] = useState('-');
  const [filename, setFilename] = useState('');
  const [command, setCommand] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [resultMessage, setResultMessage] = useState<{ text: string, error: boolean } | null>(null);

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
        (data: { message: string, error: boolean }) => {
          setResultMessage({ text: data.message, error: data.error });
        }
      );

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

  const handleFilenameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFilename(e.target.value);
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
          placeholder="output_filename"
          className="text-input"
        />
      </div>

      <div className="button-group">
        <button onClick={handleSetOutputDir} className="action-btn">
          Set Output Dir
        </button>
        <button onClick={handleShowCommand} className="action-btn">
          Show Command
        </button>
        <button onClick={handleRunFFmpeg} className="primary-btn" disabled={progress !== null}>
          {progress !== null ? 'Running...' : 'Run FFmpeg'}
        </button>
      </div>

      {progress !== null && (
        <div className="progress-container">
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
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
        <div className={`result-message ${resultMessage.error ? 'error' : 'success'}`}>
          {resultMessage.text}
        </div>
      )}
    </div>
  );
};

export default App;
