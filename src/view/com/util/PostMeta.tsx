import React, {memo} from 'react'
import {StyleProp, StyleSheet, TextStyle, View, ViewStyle} from 'react-native'
import {AppBskyActorDefs, ModerationDecision, ModerationUI} from '@atproto/api'

import {usePrefetchProfileQuery} from '#/state/queries/profile'
import {usePalette} from 'lib/hooks/usePalette'
import {makeProfileLink} from 'lib/routes/links'
import {sanitizeDisplayName} from 'lib/strings/display-names'
import {sanitizeHandle} from 'lib/strings/handles'
import {niceDate} from 'lib/strings/time'
import {TypographyVariant} from 'lib/ThemeContext'
import {isAndroid, isWeb} from 'platform/detection'
import {TextLinkOnWebOnly} from './Link'
import {Text} from './text/Text'
import {TimeElapsed} from './TimeElapsed'
import {PreviewableUserAvatar} from './UserAvatar'

interface PostMetaOpts {
  author: AppBskyActorDefs.ProfileViewBasic
  moderation: ModerationDecision | undefined
  authorHasWarning: boolean
  postHref: string
  timestamp: string
  showAvatar?: boolean
  avatarModeration?: ModerationUI
  avatarSize?: number
  displayNameType?: TypographyVariant
  displayNameStyle?: StyleProp<TextStyle>
  style?: StyleProp<ViewStyle>
}

let PostMeta = (opts: PostMetaOpts): React.ReactNode => {
  const pal = usePalette('default')
  const displayName = opts.author.displayName || opts.author.handle
  const handle = opts.author.handle
  const prefetchProfileQuery = usePrefetchProfileQuery()

  const profileLink = makeProfileLink(opts.author)
  const onPointerEnter = isWeb
    ? () => prefetchProfileQuery(opts.author.did)
    : undefined

  return (
    <View style={[styles.container, opts.style]}>
      {opts.showAvatar && (
        <View style={styles.avatar}>
          <PreviewableUserAvatar
            size={opts.avatarSize || 16}
            did={opts.author.did}
            handle={opts.author.handle}
            avatar={opts.author.avatar}
            moderation={opts.avatarModeration}
            type={opts.author.associated?.labeler ? 'labeler' : 'user'}
          />
        </View>
      )}
      <Text
        numberOfLines={1}
        style={[styles.maxWidth, pal.textLight, opts.displayNameStyle]}>
        <TextLinkOnWebOnly
          type={opts.displayNameType || 'lg-bold'}
          style={[pal.text]}
          lineHeight={1.2}
          disableMismatchWarning
          text={
            <>
              {sanitizeDisplayName(
                displayName,
                opts.moderation?.ui('displayName'),
              )}
            </>
          }
          href={profileLink}
          onPointerEnter={onPointerEnter}
        />
        <TextLinkOnWebOnly
          type="md"
          disableMismatchWarning
          style={[pal.textLight, {flexShrink: 4}]}
          text={'\xa0' + sanitizeHandle(handle, '@')}
          href={profileLink}
          onPointerEnter={onPointerEnter}
          anchorNoUnderline
        />
      </Text>
      {!isAndroid && (
        <Text
          type="md"
          style={pal.textLight}
          lineHeight={1.2}
          accessible={false}>
          &middot;
        </Text>
      )}
      <TimeElapsed timestamp={opts.timestamp}>
        {({timeElapsed}) => (
          <TextLinkOnWebOnly
            type="md"
            style={pal.textLight}
            lineHeight={1.2}
            text={timeElapsed}
            accessibilityLabel={niceDate(opts.timestamp)}
            title={niceDate(opts.timestamp)}
            accessibilityHint=""
            href={opts.postHref}
          />
        )}
      </TimeElapsed>
    </View>
  )
}
PostMeta = memo(PostMeta)
export {PostMeta}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 2,
    gap: 4,
    zIndex: 1,
    flex: 1,
  },
  avatar: {
    alignSelf: 'center',
  },
  maxWidth: {
    flex: isAndroid ? 1 : undefined,
    flexShrink: isAndroid ? undefined : 1,
    // This should take up the full space on Android. On web, it should only take up 80% so that the hover
    // timestamp fully appears. On iOS, letting it size to 90% gives us a bit more space to render things without looking
    // too close to the side of the screen
    maxWidth: isAndroid ? undefined : isWeb ? '80%' : '90%',
  },
})
