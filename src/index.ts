import dotenv from 'dotenv'
import { resolve as resolvePath } from 'path'
import yargs from 'yargs/yargs'
import { CommandModule, Argv } from 'yargs'
import { hideBin } from 'yargs/helpers'

import { generateSchemas } from './util/SchemaUtil.js'
import { DistributionStructure } from './structure/spec_model/Distribution.struct.js'
import { CurseForgeParser } from './parser/CurseForgeParser.js'
import { LoggerUtil } from './util/LoggerUtil.js'
import { MinecraftVersion } from './util/MinecraftVersion.js'
import { ServerStructure } from './structure/spec_model/Server.struct.js'

dotenv.config()

const logger = LoggerUtil.getLogger('Index')

// Fonction pour récupérer ROOT (priorité argv > .env)
function getRoot(argv: any): string {
  if (argv.root) return resolvePath(argv.root)
  if (process.env.ROOT) return resolvePath(process.env.ROOT)
  throw new Error('Root path not specified. Use --root or set ROOT in .env')
}

// Fonction pour récupérer BASE_URL valide (priorité argv > .env)
function getBaseURL(argv: any): string {
  const rawUrl = argv.baseUrl ?? process.env.BASE_URL
  if (!rawUrl) throw new Error('BASE_URL not specified. Use --baseUrl or set BASE_URL in .env')

  let urlStr = rawUrl.trim()
  if (!urlStr.match(/^https?:\/\//)) {
    // Ajoute https:// par défaut si absent
    urlStr = 'https://' + urlStr
  }

  try {
    // Valide que c'est une URL correcte
    const url = new URL(urlStr)
    return url.toString()
  } catch (err) {
    throw new Error(`Invalid BASE_URL: ${urlStr}`)
  }
}

// Commande "init root"
const initRootCommand: CommandModule = {
  command: 'root <root>',
  describe: 'Generate an empty standard file structure.',
  builder: (yargs: Argv) => yargs.positional('root', {
    describe: 'Root directory to initialize',
    type: 'string',
    coerce: (arg: string) => resolvePath(arg)
  }),
  handler: async (argv) => {
    const root = argv.root as string
    logger.debug(`Root set to ${root}`)
    logger.debug('Invoked init root.')

    try {
      await generateSchemas(root)
      await new DistributionStructure(root, '', false, false).init()
      await new CurseForgeParser(root, '').init()
      logger.info(`Successfully created new root at ${root}`)
    } catch (error: unknown) {
      logger.error(`Failed to init new root at ${root}`, error instanceof Error ? error.message : error)
      process.exit(1)
    }
  }
}

// Commande "generate server"
const generateServerCommand: CommandModule = {
  command: 'generate server <id> <version>',
  describe: 'Generate a new server configuration.',
  builder: (yargs: Argv) => yargs
    .positional('id', {
      describe: 'Server id.',
      type: 'string'
    })
    .positional('version', {
      describe: 'Minecraft version.',
      type: 'string'
    })
    .option('forge', {
      describe: 'Forge version.',
      type: 'string'
    })
    .option('fabric', {
      describe: 'Fabric version.',
      type: 'string'
    })
    .option('root', {
      describe: 'Root directory',
      type: 'string',
      demandOption: false,
      coerce: (arg: string) => resolvePath(arg)
    })
    .conflicts('forge', 'fabric'),
  handler: async (argv) => {
    let root: string
    try {
      root = getRoot(argv)
    } catch (error: unknown) {
      logger.error(error instanceof Error ? error.message : error)
      process.exit(1)
      return
    }

    logger.info(`Root: ${root}`)
    logger.info(`Generating server ${argv.id} for Minecraft ${argv.version}`)
    logger.info(`Forge: ${argv.forge ?? 'none'}, Fabric: ${argv.fabric ?? 'none'}`)

    try {
      const mcVersion = new MinecraftVersion(argv.version as string)
      const serverStruct = new ServerStructure(root, '', false, false)
      await serverStruct.createServer(argv.id as string, mcVersion, {
        forgeVersion: argv.forge as string,
        fabricVersion: argv.fabric as string
      })
      logger.info('Server generated successfully.')
    } catch (error: unknown) {
      logger.error('Error generating server:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  }
}

// Commande "generate distro"
const generateDistroCommand: CommandModule = {
  command: 'generate distro',
  describe: 'Generate distribution JSON file.',
  builder: (yargs: Argv) => yargs
    .option('root', {
      describe: 'Root directory',
      type: 'string',
      demandOption: false,
      coerce: (arg: string) => resolvePath(arg)
    })
    .option('baseUrl', {
      describe: 'Base URL for distribution',
      type: 'string',
      demandOption: false
    }),
  handler: async (argv) => {
    let root: string
    let baseUrl: string

    try {
      root = getRoot(argv)
      baseUrl = getBaseURL(argv)
    } catch (error: unknown) {
      logger.error(error instanceof Error ? error.message : error)
      process.exit(1)
      return
    }

    logger.info(`Generating distribution distribution.json at root ${root}`)
    logger.info(`Using BASE_URL: ${baseUrl}`)

    try {
      const distStruct = new DistributionStructure(root, baseUrl, false, false)
      await distStruct.init()
      logger.info('Distribution generated successfully.')
    } catch (error: unknown) {
      logger.error('Failed to generate distribution.', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  }
}

// Commande "init" principale (qui intègre init root)
const initCommand: CommandModule = {
  command: 'init',
  aliases: ['i'],
  describe: 'Base init command.',
  builder: (yargs: Argv) => yargs.command(initRootCommand),
  handler: (argv) => {
    argv._handled = true
  }
}

// Configuration yargs avec toutes les commandes
yargs(hideBin(process.argv))
  .version(false)
  .scriptName('')
  .command(initCommand)
  .command(generateServerCommand)
  .command(generateDistroCommand)
  .demandCommand()
  .help()
  .parse()
