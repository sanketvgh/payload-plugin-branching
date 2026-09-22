import { payloadPluginBranching } from 'payload-plugin-branching'
import { BranchSwitcher } from 'payload-plugin-branching/rsc'

const plugin = payloadPluginBranching({ collections: { articles: true } })

void BranchSwitcher
void plugin
