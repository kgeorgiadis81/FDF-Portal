export interface PortalHelpItem {
  title: string;
  body: string;
  example?: string;
}

export type PortalHelpKey =
  | 'signup.dateOfBirth'
  | 'signup.consent'
  | 'group.name'
  | 'group.parish'
  | 'group.groupType'
  | 'group.primaryDirector'
  | 'group.coDirector'
  | 'group.coDirectorEmail'
  | 'group.coDirectorPhone'
  | 'roster.firstName'
  | 'roster.lastName'
  | 'roster.dateOfBirth'
  | 'roster.ageAtFdf'
  | 'roster.chaperoneName'
  | 'roster.chaperonePhone'
  | 'roster.chaperone21Plus'
  | 'roster.chaperoneRequirement'
  | 'roster.submitRoster'
  | 'performance.danceName'
  | 'performance.region'
  | 'performance.village'
  | 'performance.liveMusic'
  | 'performance.recordedMusic'
  | 'performance.acapella'
  | 'performance.dancersSinging'
  | 'performance.musiciansSinging'
  | 'performance.individualSinging'
  | 'performance.musicians'
  | 'performance.instruments'
  | 'performance.tablesChairs'
  | 'performance.additionalProps'
  | 'performance.specialRequirements'
  | 'performance.musicAudioNeeds'
  | 'performance.danceOrder'
  | 'performance.round'
  | 'performance.songName'
  | 'performance.secularLiturgical'
  | 'performance.songOrder'
  | 'performance.choralAv'
  | 'costume.region'
  | 'costume.village'
  | 'costume.resources'
  | 'costume.award'
  | 'costume.purchasedMostAll'
  | 'costume.purchasedAnyParts'
  | 'costume.conflictSection'
  | 'costume.relatedGroup'
  | 'costume.sharedCount'
  | 'documents.signedRoster'
  | 'documents.youthSafety'
  | 'documents.pendingReview'
  | 'documents.rejected'
  | 'documents.verified'
  | 'documents.uploadReplacement'
  | 'deadline.section'
  | 'deadline.submitted'
  | 'review.actionRequired'
  | 'review.verified'
  | 'review.closed'
  | 'review.conflicts';

export const PORTAL_HELP: Record<PortalHelpKey, PortalHelpItem> = {
  'signup.dateOfBirth': {
    title: 'Date of Birth',
    body:
      'Enter your correct date of birth. FDF uses this information to help identify possible scheduling conflicts when a Director also participates with a group.',
  },
  'signup.consent': {
    title: 'Privacy & data responsibility',
    body: 'You must accept FDF’s privacy and data responsibility policies before your Director account can be created.',
  },
  'group.name': {
    title: 'Group Name',
    body:
      'Enter the name your group uses for FDF. This is the name FDF staff will see throughout registration and event operations.',
  },
  'group.parish': {
    title: 'Parish',
    body: 'Select the parish this group represents. Search by parish name or city.',
  },
  'group.groupType': {
    title: 'Group Type',
    body:
      'Choose Dance for a dance group or Choral for a choir or choral group. This determines which registration forms your group will use.',
  },
  'group.primaryDirector': {
    title: 'Primary Director',
    body: 'The Primary Director is the Portal account that manages this group.',
  },
  'group.coDirector': {
    title: 'Co-Director',
    body:
      'Add another person who helps direct the group. Adding a Co-Director does not create a Portal account or give that person access to this group.',
  },
  'group.coDirectorEmail': {
    title: 'Co-Director Email',
    body:
      "Enter the Co-Director's email address for FDF reference. This does not create a login for the Co-Director.",
  },
  'group.coDirectorPhone': {
    title: 'Co-Director Cell Phone',
    body: 'Enter a phone number where this Co-Director can be reached if FDF staff need to contact them.',
  },
  'roster.firstName': {
    title: 'Participant First Name',
    body: "Enter the participant's name as it should appear on the FDF roster.",
  },
  'roster.lastName': {
    title: 'Participant Last Name',
    body: "Enter the participant's name as it should appear on the FDF roster.",
  },
  'roster.dateOfBirth': {
    title: 'Date of Birth',
    body:
      "Enter the participant's correct date of birth. FDF uses it to calculate the participant's age for the event and determine chaperone requirements.",
  },
  'roster.ageAtFdf': {
    title: 'Age at FDF',
    body:
      "FDF calculates this automatically from the date of birth and the event's official age-reference date. You do not need to enter it.",
  },
  'roster.chaperoneName': {
    title: 'Chaperone Name',
    body: 'Enter the name of the adult who will serve as a chaperone for this group.',
  },
  'roster.chaperonePhone': {
    title: 'Chaperone Phone',
    body: 'Enter a phone number where this chaperone can be reached during FDF weekend.',
  },
  'roster.chaperone21Plus': {
    title: '21+ Confirmation',
    body: 'Confirm that this chaperone will be at least 21 years old at FDF.',
  },
  'roster.chaperoneRequirement': {
    title: 'Chaperone Requirement',
    body:
      'FDF requires at least one chaperone for every seven group members under age 18. If everyone in the group is 18 or older, a chaperone is not required.',
  },
  'roster.submitRoster': {
    title: 'Submit Roster',
    body:
      'Submitting tells FDF that your roster has been provided. You may continue to make changes until the roster deadline.',
  },
  'performance.danceName': {
    title: 'Dance Name',
    body:
      'Enter the name of the dance as you want FDF staff to identify it in the performance program and operational reports.',
  },
  'performance.region': {
    title: 'Region',
    body: 'Enter the Greek region associated with this dance.',
  },
  'performance.village': {
    title: 'Village',
    body: 'Enter the village associated with the dance, if applicable.',
  },
  'performance.liveMusic': {
    title: 'Live Music',
    body: 'Select this when live musicians will provide music for this dance.',
  },
  'performance.recordedMusic': {
    title: 'Recorded Music',
    body: 'Select this when recorded audio will be used for this dance.',
  },
  'performance.acapella': {
    title: 'Acapella',
    body: 'Select this when the dance will be performed without live instruments or recorded music.',
  },
  'performance.dancersSinging': {
    title: 'Dancer(s) Singing',
    body: 'Select this when members of the dance group will sing during this dance.',
  },
  'performance.musiciansSinging': {
    title: 'Musician(s) Singing',
    body: 'Select this when one or more of the selected musicians will also sing.',
  },
  'performance.individualSinging': {
    title: 'Individual Singing',
    body: 'Select this when an individual featured singer will sing during this dance.',
  },
  'performance.musicians': {
    title: 'Musicians',
    body:
      'Select the musicians who will perform with this group in this round. You may select up to 8 musicians.',
  },
  'performance.instruments': {
    title: 'Instruments',
    body:
      'Select every live instrument that will be used during this round. Choose Other if the instrument is not listed.',
  },
  'performance.tablesChairs': {
    title: 'Tables / Chairs',
    body:
      'Select Yes if your group needs FDF-provided tables or chairs during this performance.',
  },
  'performance.additionalProps': {
    title: 'Additional Props',
    body:
      'List any props your group will bring or use during the performance. Include enough detail for event staff to prepare the performance area.',
  },
  'performance.specialRequirements': {
    title: 'Special Requirements',
    body: 'Tell FDF about anything unusual that event staff should know before your performance.',
  },
  'performance.musicAudioNeeds': {
    title: 'Music / Audio Needs',
    body:
      'Describe any microphones, audio playback, or other sound needs that the AV team should prepare for.',
  },
  'performance.danceOrder': {
    title: 'Dance Order',
    body:
      'The dances appear in performance order. Drag them or use the move controls to arrange them in the exact order your group plans to perform them.',
  },
  'performance.round': {
    title: 'Round',
    body: 'Semi-Final and Final information is entered separately. Make sure you are editing the correct round.',
  },
  'performance.songName': {
    title: 'Song Name',
    body: 'Enter the title of the song as you want FDF staff to identify it.',
  },
  'performance.secularLiturgical': {
    title: 'Secular / Liturgical',
    body:
      'Choose Liturgical for a church or liturgical piece. Choose Secular for a non-liturgical piece.',
  },
  'performance.songOrder': {
    title: 'Song Order',
    body:
      'The songs appear in performance order. Arrange them in the exact order your group plans to perform them.',
  },
  'performance.choralAv': {
    title: 'Choral AV',
    body:
      'Tell the AV team about microphones, playback, or any other sound or technical needs for this performance.',
  },
  'costume.region': {
    title: 'Costume Region',
    body: 'Enter the Greek region represented by this costume.',
  },
  'costume.village': {
    title: 'Costume Village',
    body: 'Enter the village represented by this costume, if applicable.',
  },
  'costume.resources': {
    title: 'Resources',
    body:
      'Choose the main way this costume was obtained or created: Borrowed, Rented, Made, or Purchased.',
  },
  'costume.award': {
    title: 'Award',
    body: 'Select Yes if this costume has previously received a costume award at FDF.',
  },
  'costume.purchasedMostAll': {
    title: 'Purchased Most / All',
    body: 'Select Yes if most or all of this costume was purchased.',
  },
  'costume.purchasedAnyParts': {
    title: 'Purchased Any Parts',
    body: 'Select Yes if any individual parts of the costume were purchased.',
  },
  'costume.conflictSection': {
    title: 'Costume Conflict',
    body:
      'Add a costume conflict when this group shares costumes with another FDF group and the scheduling team may need time between performances to transfer the costumes.',
  },
  'costume.relatedGroup': {
    title: 'Related Group',
    body:
      'Select the other FDF group that shares these costumes. The parish is identified automatically.',
  },
  'costume.sharedCount': {
    title: 'Number of Costumes Shared',
    body: 'Enter how many costumes are shared between the two groups.',
  },
  'documents.signedRoster': {
    title: 'Signed Roster',
    body:
      'Upload the roster after it has been printed, signed, and dated by your Parish Priest. Upload the completed document as a PDF.',
  },
  'documents.youthSafety': {
    title: 'Youth Safety Compliance',
    body: 'Upload the completed Youth Safety Compliance document for this group as a PDF.',
  },
  'documents.pendingReview': {
    title: 'Pending Review',
    body: 'FDF has received this document and it is waiting for review.',
  },
  'documents.rejected': {
    title: 'Rejected',
    body:
      'FDF reviewed this document and found something that needs to be corrected. Read the reason shown and upload a replacement before the deadline.',
  },
  'documents.verified': {
    title: 'Verified',
    body: 'FDF has reviewed and accepted this document. No further changes are needed.',
  },
  'documents.uploadReplacement': {
    title: 'Upload Replacement',
    body:
      "Upload a new PDF to replace the current version. Previous versions remain in FDF's document history.",
  },
  'deadline.section': {
    title: 'Deadline',
    body:
      'The listed date is the official FDF deadline. The Portal also shows the exact time until which online changes are allowed.',
  },
  'deadline.submitted': {
    title: 'Submitted',
    body:
      'FDF has received this section. You may still make changes until its deadline.',
  },
  'review.actionRequired': {
    title: 'Action Required',
    body: 'This section needs your attention. Open it to see what must be completed or corrected.',
  },
  'review.verified': {
    title: 'Verified',
    body: 'FDF has reviewed and accepted this item. No action is needed.',
  },
  'review.closed': {
    title: 'Closed',
    body:
      'The editing deadline has passed. You can still view the information, but changes must be handled by FDF Management.',
  },
  'review.conflicts': {
    title: 'Conflicts',
    body:
      'These warnings help FDF avoid scheduling problems between groups. Review the information and contact FDF Management if something appears incorrect.',
  },
};

export function getPortalHelp(key: PortalHelpKey): PortalHelpItem {
  return PORTAL_HELP[key];
}
