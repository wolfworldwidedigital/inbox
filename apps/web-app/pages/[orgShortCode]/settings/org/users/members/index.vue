<script setup lang="ts">
  import { navigateTo, ref, useNuxtApp, watch, useRoute } from '#imports';
  import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

  const breakpoints = useBreakpoints(breakpointsTailwind);
  const isMobile = breakpoints.smaller('lg'); // only smaller than lg
  const orgShortCode = (useRoute().params.orgShortCode ?? '') as string;

  const { $trpc } = useNuxtApp();
  const { data: isAdmin } =
    await $trpc.org.users.members.isOrgMemberAdmin.useQuery({ orgShortCode });

  if (!isAdmin.value) {
    await navigateTo(`/${orgShortCode}/settings`);
  }

  const { data: orgMembersQuery, pending } =
    await $trpc.org.users.members.getOrgMembers.useLazyQuery(
      { orgShortCode },
      {
        server: false
      }
    );

  const tableColumns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true
    },
    {
      key: 'handle',
      label: 'Username',
      sortable: true
    },
    {
      key: 'title',
      label: 'Title'
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true
    },
    {
      key: 'joined',
      label: 'Joined',
      sortable: true
    }
  ];

  const tableRows = ref<{}[]>([]);
  watch(orgMembersQuery, (newResults) => {
    if (newResults?.members) {
      for (const member of newResults.members) {
        tableRows.value.push({
          name: member.profile.firstName + ' ' + member.profile.lastName,
          publicId: member.profile.publicId,
          avatarTimestamp: member.profile.avatarTimestamp,
          handle: member.profile.handle,
          title: member.profile.title,
          role: member.role,
          status: member.status,
          joined: member.addedAt.toDateString(),
          removed: member.removedAt?.toDateString()
        });
      }
    }
  });
</script>

<template>
  <div class="flex h-full w-full flex-col items-start gap-8 p-4">
    <div class="flex w-full flex-row items-center justify-between">
      <div class="flex flex-row items-center gap-4">
        <UnUiButton
          v-if="isMobile"
          icon="i-ph-arrow-left"
          square
          variant="soft"
          @click="navigateTo(`/${orgShortCode}/settings`)" />

        <div class="flex flex-col gap-1">
          <span class="font-display text-2xl">Members</span>
          <span class="text-sm">Manage your org members</span>
        </div>
      </div>
      <div class="flex flex-row items-center gap-4">
        <UnUiButton @click="navigateTo('./invites')">
          <UnUiIcon
            name="i-ph-plus"
            size="20" />
          <p class="text-sm">Invite</p>
        </UnUiButton>
      </div>
    </div>
    <div class="flex w-full flex-col gap-4 overflow-x-auto overflow-y-auto">
      <NuxtUiTable
        :columns="tableColumns"
        :rows="tableRows"
        :loading="pending"
        class="">
        <template #name-data="{ row }">
          <div class="flex flex-row items-center gap-2">
            <UnUiAvatar
              :public-id="row.publicId"
              :avatar-timestamp="row.avatarTimestamp"
              :type="'orgMember'"
              :alt="row.name ? row.name : ''"
              size="xs" />
            <span class="">{{ row.name }}</span>
          </div>
        </template>
        <template #handle-data="{ row }">
          <span class="">@{{ row.handle }}</span>
        </template>
        <template #role-data="{ row }">
          <UnUiBadge
            :color="row.role === 'admin' ? 'amber' : 'blue'"
            variant="solid">
            <span class="uppercase">{{ row.role }}</span>
          </UnUiBadge>
        </template>
        <template #status-data="{ row }">
          <UnUiBadge
            :color="row.status === 'active' ? 'green' : 'red'"
            variant="solid">
            <span class="uppercase">{{ row.status }}</span>
          </UnUiBadge>
        </template>
      </NuxtUiTable>
    </div>
  </div>
</template>
