import type { SiteConfig } from './types'

export function hasContact(contact: SiteConfig['contact']) {
  return Boolean(contact?.qq || contact?.wechat || contact?.wechatQrId || contact?.email)
}

export function qqContactUrl(qq: string, mobile = false) {
  if (!/^[1-9]\d{4,11}$/.test(qq)) return ''
  return mobile
    ? `mqqapi://card/show_pslcard?src_type=internal&version=1&uin=${qq}&card_type=person&source=external`
    : `tencent://AddContact/?fromId=50&fromSubId=1&subcmd=all&uin=${qq}`
}

// Encode reserved local-part characters such as ?, # and & rather than turning them into mail headers.
export const emailContactUrl = (email: string) => `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}`
