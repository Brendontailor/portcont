import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from './error.middleware.js';

const allowedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
];

const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv'];

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  const isValidMime = allowedMimeTypes.includes(file.mimetype);
  const isValidExt = allowedExtensions.includes(ext);

  if (isValidMime && isValidExt) {
    cb(null, true);
  } else {
    cb(new AppError(400, 'Formato de arquivo não suportado. Use PDF, XLSX, XLS ou CSV'));
  }
};

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: 10,
  },
});

export const uploadComparison = upload.fields([
  { name: 'fileA', maxCount: 5 },
  { name: 'fileB', maxCount: 10 },
]);