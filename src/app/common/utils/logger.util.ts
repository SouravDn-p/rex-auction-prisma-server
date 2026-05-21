import winston from 'winston';
import { ENV } from '../../../config/env.config.ts';

const { combine, timestamp, printf, json } = winston.format;

// ANSI escape codes for professional terminal coloring
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const formatLogLevel = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'info':
      return `${COLORS.cyan}ℹ INFO ${COLORS.reset}`;
    case 'warn':
      return `${COLORS.yellow}⚠️ WARN ${COLORS.reset}`;
    case 'error':
      return `${COLORS.red}🔥 ERROR${COLORS.reset}`;
    case 'debug':
      return `${COLORS.gray}⚙ DEBUG${COLORS.reset}`;
    default:
      return `${COLORS.white}${level.toUpperCase()}${COLORS.reset}`;
  }
};

const devFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, ...meta }) => {
    const formattedTime = `${COLORS.gray}[${timestamp}]${COLORS.reset}`;
    const levelStr = formatLogLevel(level);
    
    // ─── Prisma Query Log Parser ─────────────────────────────────────────────
    if (typeof message === 'string' && message.startsWith('Prisma Query:')) {
      const match = message.match(/Prisma Query:\s+(.+?)\s*\|\s*Duration:\s*(.+)$/);
      if (match) {
        const rawQuery = match[1] ?? '';
        const duration = match[2] ?? '';
        
        // Clean schema quotes and namespaces
        const cleanQuery = rawQuery
          .replace(/"public"\."(\w+)"/g, '$1')
          .replace(/"(\w+)"/g, '$1');
        
        // Extract database operation verb and targeted table
        const verbMatch = cleanQuery.match(/^(SELECT|INSERT|UPDATE|DELETE)/i);
        const verb = verbMatch?.[1]?.toUpperCase() ?? 'QUERY';
        
        const tableMatch = cleanQuery.match(/(?:FROM|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i);
        const tableName = tableMatch?.[1] ?? 'db';
        
        let verbColor = COLORS.cyan;
        if (verb === 'INSERT') verbColor = COLORS.green;
        if (verb === 'UPDATE') verbColor = COLORS.yellow;
        if (verb === 'DELETE') verbColor = COLORS.red;
        
        // Colorize and format duration response speeds
        const durationMs = parseFloat(duration.replace('ms', ''));
        const durationStr = durationMs.toFixed(1) + 'ms';
        let durationColor = COLORS.green;
        if (durationMs > 100) durationColor = COLORS.yellow;
        if (durationMs > 300) durationColor = COLORS.red;
        
        return `${formattedTime} ${COLORS.magenta}⚡ PRISMA${COLORS.reset} ${verbColor}${verb} ${tableName}${COLORS.reset} | ${durationColor}${durationStr}${COLORS.reset}`;
      }
    }
    
    // ─── Custom AppError Log Parser ──────────────────────────────────────────
    if (typeof message === 'string' && message.includes('[AppError]')) {
      const errorMatch = message.match(/\[AppError\]\s+(\d+)\s+-\s+(.+)$/);
      if (errorMatch) {
        const code = errorMatch[1] ?? '';
        const msg = errorMatch[2] ?? '';
        return `${formattedTime} ${COLORS.yellow}⚠️  APP_ERROR${COLORS.reset} ${COLORS.bright}${COLORS.red}${code}${COLORS.reset} - ${COLORS.white}${msg}${COLORS.reset}`;
      }
    }

    const metaStr = Object.keys(meta).length ? ` ${COLORS.dim}${JSON.stringify(meta)}${COLORS.reset}` : '';
    return `${formattedTime} ${levelStr} : ${COLORS.white}${message}${COLORS.reset}${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: ENV.IS_PRODUCTION ? 'warn' : 'debug',
  format: ENV.IS_PRODUCTION ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    ...(ENV.IS_PRODUCTION
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});