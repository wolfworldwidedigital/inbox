import { api, type RouterOutputs } from '@/src/lib/trpc';
import { useGlobalStore } from '@/src/providers/global-store-provider';
import { type TypeId } from '@u22n/utils/typeid';
import { type InfiniteData } from '@tanstack/react-query';
import { useCallback } from 'react';

export function formatParticipantData(
  participant: RouterOutputs['convos']['getOrgMemberConvos']['data'][number]['participants'][number]
) {
  const typePublicId =
    participant.orgMember?.publicId ??
    participant.team?.publicId ??
    participant.contact?.publicId;
  const avatarProfilePublicId =
    participant.orgMember?.profile.publicId ??
    participant.team?.publicId ??
    participant.contact?.publicId ??
    null;
  if (!typePublicId || !avatarProfilePublicId) return null;

  const avatarTimestampProp = participant.orgMember?.profile.avatarTimestamp
    ? participant.orgMember?.profile.avatarTimestamp
    : participant.team?.avatarTimestamp
      ? participant.team?.avatarTimestamp
      : participant.contact?.avatarTimestamp
        ? participant.contact?.avatarTimestamp
        : null;

  const nameProp = participant.team?.name
    ? participant.team?.name
    : participant.orgMember?.profile.firstName
      ? `${participant.orgMember?.profile.firstName} ${participant.orgMember?.profile.lastName ?? ''}`
      : participant.contact?.setName
        ? participant.contact?.setName
        : participant.contact?.name
          ? participant.contact?.name
          : participant.contact?.emailUsername
            ? `${participant.contact?.emailUsername}@${participant.contact?.emailDomain}`
            : 'unnamed';

  const participantAddress = participant.contact
    ? participant.contact.emailUsername + '@' + participant.contact.emailDomain
    : null;

  return {
    participantPublicId: participant.publicId,
    typePublicId: typePublicId,
    avatarProfilePublicId: avatarProfilePublicId,
    avatarTimestamp: avatarTimestampProp,
    name: nameProp,
    color: participant.team?.color,
    type: participant.orgMember
      ? 'orgMember'
      : participant.team
        ? 'team'
        : 'contact',
    role: participant.role,
    signatureHtml: participant.contact?.signatureHtml ?? null,
    signaturePlainText: participant.contact?.signaturePlainText ?? null,
    address: participantAddress
  };
}

export function useAddSingleConvo$Cache() {
  const orgShortCode = useGlobalStore((state) => state.currentOrg.shortCode);
  const utils = api.useUtils();
  const convoListApi = utils.convos.getOrgMemberConvos;
  const getOrgMemberSpecificConvoApi = utils.convos.getOrgMemberSpecificConvo;

  return useCallback(
    async (convoId: TypeId<'convos'>) => {
      const convo = await getOrgMemberSpecificConvoApi.fetch({
        convoPublicId: convoId,
        orgShortCode
      });
      convoListApi.setInfiniteData({ orgShortCode }, (updater) => {
        if (!updater) return;
        // If convo already exists in the cache, don't add it again
        if (
          updater.pages.some((page) =>
            page.data.some((c) => c.publicId === convoId)
          )
        )
          return;
        const clonedUpdater = structuredClone(updater);
        const clonedConvo = structuredClone(convo)!;
        clonedUpdater.pages.at(0)?.data.unshift(clonedConvo);
        return clonedUpdater;
      });
    },
    [convoListApi, getOrgMemberSpecificConvoApi, orgShortCode]
  );
}

export function useDeleteConvo$Cache() {
  const orgShortCode = useGlobalStore((state) => state.currentOrg.shortCode);
  const convoListApi = api.useUtils().convos.getOrgMemberConvos;
  const deleteFn = useCallback(
    (
      convoId: TypeId<'convos'>,
      // TODO: figure out these types later
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updater?: InfiniteData<RouterOutputs['convos']['getOrgMemberConvos'], any>
    ) => {
      if (!updater) return;

      const clonedUpdater = structuredClone(updater);
      for (const page of clonedUpdater.pages) {
        const convoIndex = page.data.findIndex(
          (convo) => convo.publicId === convoId
        );
        if (convoIndex === -1) continue;
        page.data.splice(convoIndex, 1);
        break;
      }
      return clonedUpdater;
    },
    []
  );

  return useCallback(
    async (convoId: TypeId<'convos'>) => {
      await convoListApi.cancel({ orgShortCode });
      await convoListApi.cancel({ orgShortCode, includeHidden: true });

      convoListApi.setInfiniteData({ orgShortCode }, (updater) =>
        deleteFn(convoId, updater)
      );
      // deleteFn(convoId, updater)
      convoListApi.setInfiniteData(
        { orgShortCode, includeHidden: true },
        (updater) => deleteFn(convoId, updater)
      );
    },
    [convoListApi, deleteFn, orgShortCode]
  );
}

// TODO: Simplify this function later, its too complex
export function useToggleConvoHidden$Cache() {
  const orgShortCode = useGlobalStore((state) => state.currentOrg.shortCode);
  const utils = api.useUtils();
  const convoApi = utils.convos.getConvo;
  const convoListApi = utils.convos.getOrgMemberConvos;
  const specificConvoApi = utils.convos.getOrgMemberSpecificConvo;

  // This function is a bit complex, but basically what it does is updates the provided updater by either removing or adding a convo based on the parameters
  const convoListUpdaterFn = useCallback(
    (
      hideFromList: boolean,
      convoToAdd: RouterOutputs['convos']['getOrgMemberSpecificConvo'] | null,
      convoToRemove: TypeId<'convos'> | null,
      // TODO: figure out these types later
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updater?: InfiniteData<RouterOutputs['convos']['getOrgMemberConvos'], any>
    ) => {
      if (!updater) return;
      const clonedUpdater = structuredClone(updater);

      if (hideFromList) {
        for (const page of clonedUpdater.pages) {
          const convoIndex = page.data.findIndex(
            (convo) => convo.publicId === convoToRemove
          );
          if (convoIndex === -1) continue;
          page.data.splice(convoIndex, 1);
          break;
        }
      } else {
        if (!convoToAdd)
          throw new Error(
            'Trying to unhide from convo list without providing the convo to add'
          );
        const clonedConvo = structuredClone(convoToAdd);
        let convoAlreadyAdded = false;
        for (const page of clonedUpdater.pages) {
          const insertIndex = page.data.findIndex(
            (convo) => convo.lastUpdatedAt < clonedConvo.lastUpdatedAt
          );
          if (insertIndex === -1) {
            continue;
          } else {
            page.data.splice(insertIndex, 0, clonedConvo);
          }
          convoAlreadyAdded = true;
          break;
        }

        // If convo is the oldest, add it to the last page as the last item
        if (!convoAlreadyAdded) {
          clonedUpdater.pages.at(-1)?.data.push(clonedConvo);
        }
      }
      return clonedUpdater;
    },
    []
  );

  return useCallback(
    async (convoId: TypeId<'convos'>, hide = false) => {
      await convoApi.cancel({ convoPublicId: convoId, orgShortCode });
      convoApi.setData({ convoPublicId: convoId, orgShortCode }, (updater) => {
        if (!updater) return;
        const clonedUpdater = structuredClone(updater);
        const participantIndex = clonedUpdater.data.participants.findIndex(
          (participant) =>
            participant.publicId === updater.ownParticipantPublicId
        );
        if (participantIndex === -1) return;
        clonedUpdater.data.participants[participantIndex]!.hidden = hide;
        return clonedUpdater;
      });

      const convoToAdd = await specificConvoApi.fetch({
        convoPublicId: convoId,
        orgShortCode
      });

      // Update both hidden and non-hidden convo lists
      await convoListApi.cancel({ orgShortCode, includeHidden: true });
      await convoListApi.cancel({ orgShortCode });

      // if we are hiding a convo, we need to remove it from the non-hidden list and add to hidden list
      if (hide) {
        convoListApi.setInfiniteData({ orgShortCode }, (updater) =>
          convoListUpdaterFn(
            /* hide from non-hidden */ true,
            null,
            convoId,
            updater
          )
        );
        convoListApi.setInfiniteData(
          { orgShortCode, includeHidden: true },
          (updater) =>
            convoListUpdaterFn(
              /* add from hidden */ false,
              convoToAdd,
              null,
              updater
            )
        );
      } else {
        // if we are un-hiding a convo, we need to remove it from the hidden list and add to non-hidden list
        convoListApi.setInfiniteData({ orgShortCode }, (updater) =>
          convoListUpdaterFn(
            /* add to non-hidden */ false,
            convoToAdd,
            null,
            updater
          )
        );
        convoListApi.setInfiniteData(
          { orgShortCode, includeHidden: true },
          (updater) =>
            convoListUpdaterFn(
              /* hide from hidden */ true,
              null,
              convoId,
              updater
            )
        );
      }
    },
    [convoApi, convoListApi, convoListUpdaterFn, orgShortCode, specificConvoApi]
  );
}

export function useUpdateConvoMessageList$Cache() {
  const orgShortCode = useGlobalStore((state) => state.currentOrg.shortCode);
  const utils = api.useUtils();
  const convoEntiresApi = utils.convos.entries.getConvoEntries;
  const singleConvoEntryApi = utils.convos.entries.getConvoSingleEntry;

  // TODO: make the reply mutation return the new convo entry, to save one API call
  return useCallback(
    async (
      convoId: TypeId<'convos'>,
      convoEntryPublicId: TypeId<'convoEntries'>
    ) => {
      await convoEntiresApi.cancel({ convoPublicId: convoId, orgShortCode });
      const convo = await singleConvoEntryApi.fetch({
        convoPublicId: convoId,
        convoEntryPublicId,
        orgShortCode
      });
      convoEntiresApi.setInfiniteData(
        { convoPublicId: convoId, orgShortCode },
        (updater) => {
          if (!updater) return;
          // If convo entry already exists in the cache, don't add it again
          if (
            updater.pages.some((page) =>
              page.entries.some((c) => c.publicId === convoEntryPublicId)
            )
          )
            return;
          const clonedUpdater = structuredClone(updater);
          const page = clonedUpdater.pages.at(-1)!;
          if (!page || !convo) return;
          const clonedConvo = structuredClone(convo.entry);
          page.entries.unshift(clonedConvo);
          return clonedUpdater;
        }
      );
    },
    [convoEntiresApi, orgShortCode, singleConvoEntryApi]
  );
}
