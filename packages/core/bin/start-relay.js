#!/usr/bin/env node

const commander = require('commander')
const WebhookManager = require('@arkecosystem/core-webhooks')
const logger = require('@arkecosystem/core-logger')
const config = require('@arkecosystem/core-config')
const DatabaseInterface = require('@arkecosystem/core-database')
const PublicAPI = require('@arkecosystem/core-api-public')

// TODO: think about extracting this into @arkecosystem/core-api-p2p
const P2PInterface = require('../src/api/p2p/p2pinterface')

const BlockchainManager = require('../src/core/managers/blockchain')
const DependencyHandler = require('../src/core/dependency-handler')
const TransactionHandler = require('../src/core/transaction-handler')

commander
  .version(require('../package.json').version)
  .option('-c, --config <path>', 'config files path')
  .option('-i, --interactive', 'launch cli')
  .parse(process.argv)

process.on('unhandledRejection', (reason, p) => console.error(`Unhandled Rejection at: ${JSON.stringify(p)} reason: ${JSON.stringify(reason)}`))

const start = async () => {
  try {
    await config.init(commander.config)
    await logger.init(config.server.logging, config.network.name)

    const blockchainManager = await new BlockchainManager(config)

    logger.info('Initialising Dependencies...')
    await DependencyHandler.checkDatabaseLibraries(config)

    // TODO: implement some system to see if webhooks are enabled and @arkecosystem/core-webhooks is installed
    logger.info('Initialising Webhook Manager...')
    await new WebhookManager().init()

    logger.info('Initialising Database Interface...')
    const db = await DatabaseInterface.create(config.server.database)
    await blockchainManager.attachDatabaseInterface(db)

    logger.info('Initialising P2P Interface...')
    const p2p = new P2PInterface(config)
    await p2p.warmup()
    await blockchainManager.attachNetworkInterface(p2p)

    logger.info('Initialising Transaction Pool...')
    const txHandler = await new TransactionHandler(config)
    await blockchainManager.attachTransactionHandler(txHandler)

    logger.info('Initialising Blockchain Manager...')
    await blockchainManager.start()
    await blockchainManager.isReady()

    // TODO: implement some system to see if the public api is enabled and @arkecosystem/core-api-public is installed
    logger.info('Initialising Public API...')
    await PublicAPI()
  } catch (error) {
    console.error(error.stack)
    process.exit(1)
  }
}

start()
