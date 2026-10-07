'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import styles from './FileUploader.module.css';

interface FileUploaderProps {
  label: string;
  side: 'A' | 'B';
  onFileSelect: (side: 'A' | 'B', file: File | null) => void;
  acceptedTypes: string[];
  maxSizeMB: number;
  disabled?: boolean;
  illustration?: string;
}

export default function FileUploader({
  label,
  side,
  onFileSelect,
  acceptedTypes,
  maxSizeMB,
  disabled = false,
  illustration,
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptedExtensions = acceptedTypes
    .filter(type => type.startsWith('.'))
    .map(type => type.toLowerCase());

  const validateFile = useCallback((f: File): boolean => {
    const maxSize = maxSizeMB * 1024 * 1024;
    if (f.size > maxSize) {
      setError(`Arquivo excede o tamanho máximo de ${maxSizeMB}MB`);
      return false;
    }
    const lowerName = f.name.toLowerCase();
    const isValidType = acceptedTypes.includes(f.type)
      || acceptedExtensions.some(extension => lowerName.endsWith(extension));
    if (!isValidType) {
      setError('Formato de arquivo não suportado. Use PDF, XLSX, XLS ou CSV');
      return false;
    }
    setError(null);
    return true;
  }, [acceptedExtensions, acceptedTypes, maxSizeMB]);

  const handleFileSelect = useCallback((f: File | null) => {
    if (f && !validateFile(f)) {
      setFile(null);
      onFileSelect(side, null);
      return;
    }
    setFile(f);
    onFileSelect(side, f);
  }, [side, onFileSelect, validateFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave' || e.type === 'drop') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [disabled, handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
    onFileSelect(side, null);
  };

  const triggerInput = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      triggerInput();
    }
  };

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>{label}</label>

      <div
        className={`${styles.dropzone} ${dragActive ? styles.active : ''} ${file ? styles.hasFile : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={triggerInput}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={file ? `${label}: ${file.name}. Clique para substituir o arquivo.` : `Selecionar arquivo para ${label}`}
        aria-describedby={error ? `upload-error-${side}` : undefined}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          disabled={disabled}
          className={styles.input}
          aria-label={`Selecionar arquivo para ${label}`}
        />

        {file ? (
          <div className={styles.fileInfo}>
            <span className={styles.fileIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2.75h8l4 4V21.25H6z"/><path d="M14 2.75v4h4M9 12h6M9 16h6"/>
              </svg>
            </span>
            <div className={styles.fileDetails}>
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.fileMeta}>
                {file.type} • {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              disabled={disabled}
              onClick={(e) => { e.stopPropagation(); removeFile(); }}
              aria-label={`Remover ${file.name}`}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className={styles.dropzoneContent}>
            {illustration && (
              <div className={styles.illustrationWrapper} aria-hidden="true">
                <Image
                  src={illustration}
                  alt=""
                  width={140}
                  height={100}
                  className={styles.illustration}
                />
              </div>
            )}
            <div className={styles.dropzoneIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v6M9.5 14l2.5 2.5 2.5-2.5"/></svg></div>
            <p className={styles.dropzoneText}>Arraste o arquivo aqui ou clique para selecionar</p>
            <p className={styles.dropzoneHint}>
              PDF, XLSX, XLS ou CSV • Máx. {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {error && <p id={`upload-error-${side}`} className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
