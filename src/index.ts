import dotenv from 'dotenv'
import { resolve as resolvePath } from 'path'
import yargs from 'yargs/yargs'
import { CommandModule, Argv } from 'yargs'
import { hideBin } from 'yargs/helpers'
import { generateSchemas } from './util/SchemaUtil.js'
import { DistributionStructure } from './structure/spec_model/Distribution.struct.js'
import { CurseForgeParser } from './parser/CurseForgeParser.js'
import { LoggerUtil } from './util/LoggerUtil.js'

dotenv.config()

const logger = LoggerUtil.getLogger('Index')

// Commande "init root" avec paramètre positionnel root obligatoire
const initRootCommand: CommandModule = {
  command: 'root <root>',
  describe: 'Generate an empty standard file structure.',
  builder: (yargs: Argv) => {
    return yargs.positional('root', {
      describe: 'Root directory to initialize',
      type: 'string',
      coerce: (arg: string) => resolvePath(arg) // Résoudre le chemin absolu
    })
  },
  handler: async (argv) => {
    const root = argv.root as string
    logger.debug(`Root set to ${root}`)
    logger.debug('Invoked init root.')

    try {
      await generateSchemas(root)
      await new DistributionStructure(root, '', false, false).init()
      await new CurseForgeParser(root, '').init()
      logger.info(`Successfully created new root at ${root}`)
    } catch (error) {
      logger.error(`Failed to init new root at ${root}`, error)
    }
  }
}

// Commande "init" de base, qui regroupe "init root"
const initCommand: CommandModule = {
  command: 'init',
  aliases: ['i'],
  describe: 'Base init command.',
  builder: (yargs: Argv) => {
    return yargs.command(initRootCommand)
  },
  handler: (argv) => {
    argv._handled = true
  }
}

// Configuration générale de yargs et enregistrement des commandes
yargs(hideBin(process.argv))
  .version(false)
  .scriptName('')
  .command(initCommand)
  .demandCommand()
  .help()
  .parse()
