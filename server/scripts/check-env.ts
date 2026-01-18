if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR: db:push is forbidden in production! Use db:migrate instead.');
  process.exit(1);
}
console.log('✅ Local environment detected, proceeding...');
