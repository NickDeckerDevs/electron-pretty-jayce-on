module.exports = {
  packagerConfig: {
    name: 'JSON Prettifier',
    icon: './icon',
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'JSONPrettifier'
      }
    },
    {
      name: '@electron-forge/maker-dmg'
    }
  ]
};
