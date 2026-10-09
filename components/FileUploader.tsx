'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import styles from './FileUploader.module.css';

interface FileUploaderProps {
  label: string;
  context: string;
  side: 'A' | 'B';
  onFileSelect: (side: 'A' | 'B', files: File[]) => void;
  acceptedTypes: string[];
  maxSizeMB: number;
  maxFiles?: number;
  disabled?: boolean;
  illustration?: string;
}

export default function FileUploader({
  label,
  context,
  side,
  onFileSelect,
  acceptedTypes,
  maxSizeMB,
  maxFiles = side === 'B' ? 10 : 1,
  disabled = false,
  illustration,
}: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptedExtensions = acceptedTypes
    .filter(type => type.startsWith('.'))
    .map(type => type.toLowerCase());

  const validateFile = useCallback((f: File): boolean => {
    const maxSize = maxSizeMB * 1024 * 1024;
    if (f.size > maxSize) {
      setError(`Arquivo "${f.name}" excede o tamanho máximo de ${maxSizeMB}MB`);
      return false;
    }
    const lowerName = f.name.toLowerCase();
    const isValidType = acceptedTypes.includes(f.type)
      || acceptedExtensions.some(extension => lowerName.endsWith(extension));
    if (!isValidType) {
      setError(`Formato de arquivo não suportado: "${f.name}". Use PDF, XLSX, XLS ou CSV`);
      return false;
    }
    if (files.length >= maxFiles) {
      setError(`Máximo de ${maxFiles} arquivos permitidos para ${label}`);
      return false;
    }
    setError(null);
    return true;
  }, [acceptedExtensions, acceptedTypes, maxSizeMB, maxFiles, files.length, label]);

  const handleFilesSelect = useCallback((newFiles: File[]) => {
    const validFiles: File[] = [];
    for (const f of newFiles) {
      if (validateFile(f)) {
        validFiles.push(f);
      }
    }
    if (validFiles.length > 0) {
      const updatedFiles = [...files, ...validFiles].slice(0, maxFiles);
      setFiles(updatedFiles);
      onFileSelect(side, updatedFiles);
    }
  }, [files, maxFiles, onFileSelect, side, validateFile]);

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
      handleFilesSelect(Array.from(e.dataTransfer.files));
    }
  }, [disabled, handleFilesSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelect(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onFileSelect(side, updatedFiles);
  };

  const clearAll = () => {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = '';
    onFileSelect(side, []);
  };

  const triggerInput = () => {
    if (!disabled && files.length < maxFiles) inputRef.current?.click();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && files.length < maxFiles) {
      event.preventDefault();
      triggerInput();
    }
  };

  const isMaxFiles = files.length >= maxFiles;

  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>
        <strong className={`${styles.baseLabel} ${side === 'A' ? styles.baseA : styles.baseB}`}>{label}</strong>
        <span>{context}</span>
        {maxFiles > 1 && (
          <span className={styles.fileCounter}>{files.length} / {maxFiles}</span>
        )}
      </div>

      <div
        className={`${styles.dropzone} ${dragActive ? styles.active : ''} ${files.length > 0 ? styles.hasFiles : ''} ${isMaxFiles ? styles.maxFiles : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={triggerInput}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled || isMaxFiles ? -1 : 0}
        aria-disabled={disabled || isMaxFiles}
        aria-label={files.length > 0 ? `${label}: ${files.length} arquivo(s) selecionado(s). ${isMaxFiles ? 'Limite atingido.' : 'Clique para adicionar mais.'}` : `Selecionar arquivo(s) para ${label}`}
        aria-describedby={error ? `upload-error-${side}` : undefined}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          disabled={disabled || isMaxFiles}
          className={styles.input}
          multiple={maxFiles > 1}
          aria-label={`Selecionar arquivo(s) para ${label}`}
        />

        {files.length > 0 ? (
          <div className={styles.filesList}>
            {files.map((file, index) => (
              <div key={`${file.name}-${index}-${file.size}`} className={styles.fileItem}>
                <span className={styles.fileIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2.75h8l4 4V21.25H6z"/><path d="M14 2.75v4h4M9 12h6M9 16h6"/>
                  </svg>
                </span>
                <div className={styles.fileDetails}>
                  <div className={styles.fileName}>{file.name}</div>
                  <div className={styles.fileMeta}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  disabled={disabled}
                  onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                  aria-label={`Remover ${file.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
            {files.length > 1 && (
              <button
                type="button"
                className={styles.clearAllBtn}
                disabled={disabled}
                onClick={(e) => { e.stopPropagation(); clearAll(); }}
                aria-label="Remover todos os arquivos"
              >
                Remover todos
              </button>
            )}
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
            <p className={styles.dropzoneText}>Arraste o(s) arquivo(s) aqui ou clique para selecionar</p>
            <p className={styles.dropzoneHint}>
              PDF, XLSX, XLS ou CSV • Máx. {maxSizeMB}MB • {maxFiles > 1 ? `Até ${maxFiles} arquivos` : '1 arquivo'}
            </p>
          </div>
        )}
      </div>

      {error && <p id={`upload-error-${side}`} className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
