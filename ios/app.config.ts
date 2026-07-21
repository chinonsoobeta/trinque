import appJson from './app.json';

const productionHost = 'trinque2.chinonsoobeta.workers.dev';
const universalLinkHost = (process.env.EXPO_PUBLIC_TRINQUE_UNIVERSAL_LINK_HOST ?? productionHost).replace(/^https?:\/\//, '').replace(/\/$/, '');

const config = {
  ...appJson.expo,
  ios: {
    ...appJson.expo.ios,
    associatedDomains: [`applinks:${universalLinkHost}`],
  },
};

export default config;
