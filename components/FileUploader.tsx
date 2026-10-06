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

  const validateFile = useCallback((f: File): boolean => {
    const maxSize = maxSizeMB * 1024 * 1024;
    if (f.size > maxSize) {
      setError(`Arquivo excede o tamanho máximo de ${maxSizeMB}MB`);
      return false;
    }
    const isValidType = acceptedTypes.some(type => f.type === type || f.name.toLowerCase().endsWith(type.replace('application/', '.').replace('vnd.openxmlformats-officedocument.', '').replace('ms-excel', 'xls')));
    if (!isValidType) {
      setError('Formato de arquivo não suportado. Use PDF, XLSX, XLS ou CSV');
      return false;
    }
    setError(null);
    return true;
  }, [acceptedTypes, maxSizeMB]);

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
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

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

  const getFileIcon = (f: File) => {
    if (f.type === 'application/pdf') return '📄';
    if (f.type.includes('spreadsheet') || f.type.includes('excel') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) return '📊';
    if (f.type.includes('csv') || f.name.endsWith('.csv')) return '📋';
    return '📄';
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
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={`Área de upload do arquivo ${label}`}
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
            <span className={styles.fileIcon}>{getFileIcon(file)}</span>
            <div className={styles.fileDetails}>
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.fileMeta}>
                {file.type} • {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
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
            <div className={styles.dropzoneIcon}>📁</div>
            <p className={styles.dropzoneText}>Arraste o arquivo aqui ou clique para selecionar</p>
            <p className={styles.dropzoneHint}>
              PDF, XLSX, XLS ou CSV • Máx. {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}