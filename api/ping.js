module.exports = function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ ok: true, probe: 'js', now: new Date().toISOString() });
};
