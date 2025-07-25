import { createLogger, format, transports, Logger } from 'winston'
import { SPLAT } from 'triple-beam'
import { DateTime } from 'luxon'
import { inspect } from 'util'

export class LoggerUtil {

    public static getLogger(label: string): Logger {
        return createLogger({
            format: format.combine(
                format.label(),
                format.colorize(),
                format.label({ label }),
                format.printf(info => {
                    const splat = info[SPLAT] as unknown[] | undefined

                    if (splat) {
                        if (splat.length === 1 && splat[0] instanceof Error) {
                            const err: Error = splat[0]
                            if (typeof info.message === 'string' && info.message.length > err.message.length && info.message.endsWith(err.message)) {
                                info.message = info.message.substring(0, info.message.length - err.message.length)
                            }
                        } else if (splat.length > 0) {
                            info.message += ' ' + splat.map((it: any) => {
                                if (typeof it === 'object' && it != null) {
                                    return inspect(it, false, 4, true)
                                }
                                return it
                            }).join(' ')
                        }
                    }

                    if (typeof info.message === 'object') {
                        info.message = inspect(info.message, false, 4, true)
                    }

                    return `[${DateTime.local().toFormat('yyyy-MM-dd TT').trim()}] [${info.level}] [${info.label}]: ${info.message}${info.stack ? `\n${info.stack}` : ''}`
                })
            ),
            level: 'debug',
            transports: [
                new transports.Console()
            ]
        })
    }

}
