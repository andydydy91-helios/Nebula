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
console.log('ROOT env:', process.env.ROOT)
const logger = LoggerUtil.getLogger('Index')

// Fonction pour récupérer la racine (root) depuis argv ou .env
function getRoot(argv: any): string {
  if (argv.root) return resolvePath(argv.root)
  if (process.env.ROOT) return resolvePath(process.env.ROOT)
  throw new Error('Root path not specified. Use --root or set ROOT in .env')
}

// Commande: init root <root>
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

// Commande: init (regroupe init root)
const initCommand: CommandModule = {
  command: 'init',
  aliases: ['i'],
  describe: 'Base init command.',
  builder: (yargs: Argv) => yargs.command(initRootCommand),
  handler: (argv) => {
    argv._handled = true
  }
}

// Commande: generate server <id> <version>
const generateServerCommand: CommandModule = {
  command: 'server <id> <version>',
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
    } catch (e: any) {
      logger.error(e.message)
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
    } catch (error) {
      logger.error('Error generating server:', error)
    }
  }
}

// Commande: generate distro [name]
const generateDistroCommand: CommandModule = {
  command: 'distro [name]',
  describe: 'Generate a distribution index from the root file structure.',
  builder: (yargs: Argv) => yargs
    .positional('name', {
      describe: 'Distribution file name',
      type: 'string',
      default: 'distribution'
    })
    .option('root', {
      describe: 'Root directory',
      type: 'string',
      demandOption: false,
      coerce: (arg: string) => resolvePath(arg)
    }),
  handler: async (argv) => {
    let root: string
    try {
      root = getRoot(argv)
    } catch (e: any) {
      logger.error(e.message)
      process.exit(1)
      return
    }

    const finalName = `${argv.name}.json`
    logger.info(`Generating distribution ${finalName} at root ${root}`)

    try {
      const distributionStruct = new DistributionStructure(root, '', false, false)
      const distro = await distributionStruct.getSpecModel()
      const fs = await import('fs/promises')
      const path = await import('path')
      const distroOut = JSON.stringify(distro, null, 2)
      const distroPath = path.resolve(root, finalName)
      await fs.writeFile(distroPath, distroOut)
      logger.info(`Successfully generated ${finalName}`)
      logger.info(`Saved to ${distroPath}`)
    } catch (error) {
      logger.error('Failed to generate distribution.', error)
    }
  }
}

// Commande: generate (regroupe generate server & distro)
const generateCommand: CommandModule = {
  command: 'generate',
  aliases: ['g'],
  describe: 'Base generate command.',
  builder: (yargs: Argv) => yargs
    .command(generateServerCommand)
    .command(generateDistroCommand),
  handler: (argv) => {
    argv._handled = true
  }
}

// Configuration finale de yargs
yargs(hideBin(process.argv))
  .version(false)
  .scriptName('')
  .command(initCommand)
  .command(generateCommand)
  .demandCommand()
  .help()
  .parse()
