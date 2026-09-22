import { readFile, writeFile } from 'node:fs/promises'
const project = JSON.parse(await readFile('docs/projects/picagent.json', 'utf8'))
// The manifest is the editorial source of truth. Preserve its copy and screenshots.
if (!Array.isArray(project.metadata.projectModules) || !project.metadata.projectModules.length) {
  throw new Error('Add project modules to docs/projects/picagent.json before preparing.')
}
project.metadata.projectScreenshots ??= []
const root = 'D:/Users/Desktop/picagent/pic-agent-java/agent-user/agent-user-service/src/main/kotlin/com/onion/picagent/'
const extra = [
  'character/CharacterWorkshopController.kt','character/CharacterAppController.kt','character/CharacterLifecycleController.kt','character/CharacterController.kt','character/CharacterDiscoveryController.kt','character/CharacterCollectionController.kt','character/CharacterFollowController.kt','character/CharacterCharacterFollowController.kt','character/CharacterCommentController.kt','character/CharacterDiaryController.kt','character/CharacterExpressionController.kt','character/CharacterFmController.kt','character/CharacterArticleController.kt','character/CharacterMediaController.kt','character/CharacterTimbreController.kt','character/CharacterTimbreGenerationController.kt','character/CharacterStarController.kt','character/CharacterGiftController.kt','character/CharacterRelationshipController.kt','character/CharacterSettingController.kt','character/CharacterHotController.kt','character/CharacterTagController.kt',
  'moment/MomentController.kt','skill/SkillController.kt','topicgroup/TopicGroupRoomController.kt','topicgroup/TopicGroupInvitationController.kt','topicgroup/TopicGroupMessageController.kt','MediaGenerationController.kt','UserChatController.kt','UserGenerationTaskController.kt','CharacterMarketController.kt','WorkController.kt','UserController.kt','UserAuthController.kt','UserFollowController.kt','WalletController.kt','WalletRechargeController.kt','CheckinController.kt','CustomerCenterController.kt','BrowseHistoryController.kt',
]
project.sources = [...new Set([...project.sources, ...extra.map(path => root + 'controller/' + path), root + 'service/character/personality/CharacterPersonalityService.kt'])]
await writeFile('docs/projects/picagent.json', JSON.stringify(project, null, 2) + '\n')
console.log(`Prepared ${project.metadata.projectModules.length} modules; ${project.metadata.projectScreenshots.length} screenshots preserved.`)
