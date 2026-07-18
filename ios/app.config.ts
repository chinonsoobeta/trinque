import appJson from './app.json';

const productionHost = 'trinque-dish-discovery.r7bv67rgkk.chatgpt.site';
const universalLinkHost = (process.env.EXPO_PUBLIC_TRINQUE_UNIVERSAL_LINK_HOST ?? productionHost).replace(/^https?:\/\//, '').replace(/\/$/, '');

const config = {
  ...appJson.expo,
  ios: {
    ...appJson.expo.ios,
    associatedDomains: [`applinks:${universalLinkHost}`],
  },
};

export default config;
