// @flow
import {isMobile} from '../constants/platform'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {MaybePopupHoc} from '../common-adapters'

const routeTree = () => {
  const TeamsContainer = require('./container').default
  const AddPeopleDialog = require('./add-people/container').default
  const InviteByEmailDialog = require('./invite-by-email/container').default
  const NewTeamDialog = require('./new-team/container').default
  const JoinTeamDialog = require('./join-team/container').default
  const ManageChannels = require('../chat/manage-channels/container').default
  const EditChannel = require('../chat/manage-channels/edit-channel-container').default
  const EditTeamAvatar = require('../profile/edit-avatar/container').default
  const EditTeamDescription = require('./edit-team-description/container').default
  const CreateChannel = require('../chat/create-channel/container').default
  const ReallyLeaveTeam = require('./really-leave-team/container').default
  const RolePicker = require('./role-picker/container').default
  const ControlledRolePicker = require('./role-picker/controlled-container').default
  const Member = require('./team/member/container').default
  const ReallyRemoveMember = require('./team/really-remove-member/container').default
  const Team = require('./team/container').default
  const RetentionWarning = require('./team/settings-tab/retention/warning/container').default
  const makeManageChannels = {
    chatCreateChannel: {
      children: {},
      component: CreateChannel,
      tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
    },
    chatManageChannels: {
      children: {
        chatEditChannel: {
          children: {},
          component: MaybePopupHoc(false)(EditChannel),
          tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
        },
      },
      component: ManageChannels,
      tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
    },
  }

  const rolePicker = {
    children: {},
    component: RolePicker,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  }
  const reallyLeaveTeam = {
    children: {},
    component: ReallyLeaveTeam,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  }
  const controlledRolePicker = {
    children: {},
    component: ControlledRolePicker,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  }
  const reallyRemoveMember = {
    children: {},
    component: ReallyRemoveMember,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  }

  const showNewTeamDialog = {
    children: {},
    component: NewTeamDialog,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  }

  const makeAddPeopleOptions = {
    addPeople: {
      children: {controlledRolePicker},
      component: AddPeopleDialog,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    inviteByEmail: {
      children: {controlledRolePicker},
      component: InviteByEmailDialog,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
  }

  const retentionWarning = {
    children: {},
    component: RetentionWarning,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  }

  const teamRoute = makeRouteDefNode({
    children: {
      ...makeManageChannels,
      ...makeAddPeopleOptions,
      controlledRolePicker,
      editTeamAvatar: {
        component: EditTeamAvatar,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      editTeamDescription: {
        children: {},
        component: MaybePopupHoc(true)(EditTeamDescription),
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      member: {
        children: {
          reallyLeaveTeam,
          reallyRemoveMember,
          rolePicker,
        },
        component: Member,
      },
      reallyLeaveTeam,
      reallyRemoveMember,
      retentionWarning,
      rolePicker,
      showNewTeamDialog,
      team: () => teamRoute,
    },
    component: Team,
  })
  return makeRouteDefNode({
    children: {
      ...makeManageChannels,
      showJoinTeamDialog: {
        children: {},
        component: JoinTeamDialog,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      showNewTeamDialog,
      team: teamRoute,
    },
    component: TeamsContainer,
    tags: makeLeafTags({title: 'Teams'}),
  })
}

export default routeTree

export const newRoutes = {
  controlledRolePicker: {getScreen: () => require('./role-picker/controlled-container').default},
  editTeamDescription: {
    getScreen: () => MaybePopupHoc(true)(require('./edit-team-description/container').default),
  },
  member: {getScreen: () => require('./team/member/container').default},
  showJoinTeamDialog: {getScreen: () => require('./join-team/container').default},
  showNewTeamDialog: {getScreen: () => require('./new-team/container').default},
  'tabs.teamsTab': {getScreen: () => require('./container').default},
  team: {getScreen: () => require('./team/container').default},
}

export const newModalRoutes = {
  addPeople: {getScreen: () => require('./add-people/container').default},
  inviteByEmail: {getScreen: () => require('./invite-by-email/container').default},
  reallyLeaveTeam: {getScreen: () => require('./really-leave-team/container').default},
  reallyRemoveMember: {getScreen: () => require('./team/really-remove-member/container').default},
  retentionWarning: {getScreen: () => require('./team/settings-tab/retention/warning/container').default},
  rolePicker: {getScreen: () => require('./role-picker/container').default},
}
