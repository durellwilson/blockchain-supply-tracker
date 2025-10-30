const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory blockchain simulation (in production, use actual blockchain)
class SupplyChainBlock {
  constructor(index, timestamp, data, previousHash) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
    this.nonce = 0;
  }

  calculateHash() {
    return crypto.createHash('sha256')
      .update(this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce)
      .digest('hex');
  }

  mineBlock(difficulty) {
    const target = Array(difficulty + 1).join("0");
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
  }
}

class SupplyChain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2;
    this.pendingTransactions = [];
  }

  createGenesisBlock() {
    return new SupplyChainBlock(0, Date.now(), "Genesis Block", "0");
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addTransaction(transaction) {
    this.pendingTransactions.push(transaction);
  }

  minePendingTransactions() {
    const block = new SupplyChainBlock(
      this.chain.length,
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );

    block.mineBlock(this.difficulty);
    this.chain.push(block);
    this.pendingTransactions = [];
  }

  createTransaction(from, to, product, action, metadata = {}) {
    return {
      id: crypto.randomUUID(),
      from,
      to,
      product,
      action,
      metadata,
      timestamp: Date.now()
    };
  }

  getProductHistory(productId) {
    const history = [];
    for (const block of this.chain) {
      if (block.data && Array.isArray(block.data)) {
        for (const transaction of block.data) {
          if (transaction.product && transaction.product.id === productId) {
            history.push({
              ...transaction,
              blockIndex: block.index,
              blockHash: block.hash,
              blockTimestamp: block.timestamp
            });
          }
        }
      }
    }
    return history.sort((a, b) => a.timestamp - b.timestamp);
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }
}

// Initialize blockchain
const supplyChain = new SupplyChain();

// Sample data
const sampleProducts = [
  {
    id: 'AUTO-001',
    name: 'Engine Block',
    manufacturer: 'Detroit Engine Co.',
    category: 'Automotive Parts'
  },
  {
    id: 'FOOD-001', 
    name: 'Organic Apples',
    manufacturer: 'Michigan Farms',
    category: 'Food & Beverage'
  }
];

// Add sample transactions
sampleProducts.forEach(product => {
  const transactions = [
    supplyChain.createTransaction(
      'Manufacturer',
      'Quality Control',
      product,
      'MANUFACTURED',
      { location: 'Detroit, MI', quality: 'A+' }
    ),
    supplyChain.createTransaction(
      'Quality Control',
      'Warehouse',
      product,
      'QUALITY_APPROVED',
      { inspector: 'John Doe', certifications: ['ISO9001'] }
    ),
    supplyChain.createTransaction(
      'Warehouse',
      'Distributor',
      product,
      'SHIPPED',
      { carrier: 'FastShip Logistics', trackingNumber: 'FS123456' }
    )
  ];
  
  transactions.forEach(tx => supplyChain.addTransaction(tx));
});

supplyChain.minePendingTransactions();

// API Routes
app.get('/api/products', (req, res) => {
  res.json(sampleProducts);
});

app.get('/api/product/:id/history', (req, res) => {
  const productId = req.params.id;
  const history = supplyChain.getProductHistory(productId);
  res.json({
    productId,
    history,
    totalSteps: history.length,
    isValid: supplyChain.isChainValid()
  });
});

app.get('/api/product/:id/qr', async (req, res) => {
  try {
    const productId = req.params.id;
    const trackingUrl = `${req.protocol}://${req.get('host')}/track/${productId}`;
    const qrCode = await QRCode.toDataURL(trackingUrl);
    res.json({ qrCode, trackingUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.post('/api/product/:id/update', (req, res) => {
  const productId = req.params.id;
  const { from, to, action, metadata } = req.body;
  
  const product = sampleProducts.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const transaction = supplyChain.createTransaction(from, to, product, action, metadata);
  supplyChain.addTransaction(transaction);
  supplyChain.minePendingTransactions();

  res.json({
    success: true,
    transactionId: transaction.id,
    blockIndex: supplyChain.getLatestBlock().index
  });
});

app.get('/api/blockchain/status', (req, res) => {
  res.json({
    totalBlocks: supplyChain.chain.length,
    isValid: supplyChain.isChainValid(),
    difficulty: supplyChain.difficulty,
    pendingTransactions: supplyChain.pendingTransactions.length
  });
});

app.get('/track/:id', (req, res) => {
  res.sendFile(__dirname + '/public/track.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Blockchain Supply Chain Tracker running on port ${PORT}`);
});
