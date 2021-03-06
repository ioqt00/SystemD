import fs from 'fs'
import cryptoServer from "./cryptoServer";
import ProjectNotification from "./classes/ProjectNotification";
import axios from "axios"

/****************************
 * objet permettant de gerer les notification internes et push simultanément
 * @type {{translateAndFormatMessage(*, *, *=): *, getSubscriptions(*=): *, i18nNotifs: {}, CheckThenNotify(*, *, *=): void, initializeWebpush(): *, notifyGlobally(*=, *=, *=, *=, *=): void, sendNotif(*=, *=): void}}
 */
const NotifPush = {
    /*******************************************
     * on stockera ici les listes de traductions récupérés afins de pas avoir a les récuperer plusieurs fois
     */
    i18nNotifs: {},

    sendNotif(userIds, message) {
        this.getSubscriptions(userIds).forEach((pushSubscription) => {
            let notification = this.translateAndFormatMessage(pushSubscription.language, message)
            notification.icon = "https://www.system-d.org/images/icon/iconfatNotifs.png"
            notification.click_action = "https://www.system-d.org/"
            let payload = {
                notification: notification,
            }

            if (pushSubscription.tokens.length === 1) {
                payload.to = pushSubscription.tokens[0]
            } else {
                payload.registration_ids = pushSubscription.tokens
            }
            axios.post("https://fcm.googleapis.com/fcm/send",
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'key=' + Meteor.settings.FcmServerKey
                    }
                }).then((res) => {
                    console.log(res)
            })
                .catch(err => console.error(err))
        })
    },
    /******************************
     * recupere l'objet subscription pour un utilisateur donné
     * @param userIds
     * @returns {Array}
     */
    getSubscriptions(userIds) {
        let pushSubscriptions = []
        let usersToNotify = Meteor.users.find({_id: {"$in": userIds}}, {
            fields: {
                "public.language": 1,
                "private.tokens": 1
            }
        })
        usersToNotify.fetch().forEach(user => {
            let tokens = user.private.tokens
            if (tokens && tokens.length) {
                pushSubscriptions.push({tokens: tokens, language: user.public.language})
            }
        })
        console.log(pushSubscriptions)
        return pushSubscriptions
    },
    /***********************
     * traduit un message dans la locale de l'utilisateur avant de le formatter pour qu'il soit envoyé en notif push
     * @param language
     * @param message
     * @param title
     * @returns {Buffer}
     */
    translateAndFormatMessage(language, message, title) {
        if (!(language in this.i18nNotifs)) {
            this.i18nNotifs[language] = JSON.parse(fs.readFileSync(Meteor.absolutePath + '/i18n/' + language.split('-')[0] + '.i18n.json')).notifItem;
        }
        let translatedMessage = this.i18nNotifs[language][message]
        let translatedTitle
        if (title) {
            translatedTitle = this.i18nNotifs[language][title]
        } else {
            translatedTitle = this.i18nNotifs[language]["genericTitle"]
        }
        let translatedAction = this.i18nNotifs[language]["genericAction"]
        return {
            title: translatedTitle,
            body: translatedMessage,
        }
    },
    /***********************************
     * verifie que le tableau de memmbres a notifier est valide avant d'envoyer les notifs
     * @param membersToNotifyIds
     * @param notifObjects
     * @param message
     * @constructor
     */
    CheckThenNotify(membersToNotifyIds, notifObjects, message) {
        let userIds = []
        notifObjects.forEach(notifObject => {
            let index = membersToNotifyIds.indexOf(notifObject.memberId)
            if (index >= 0) {
                if (cryptoServer.fastCompare(membersToNotifyIds[index] + notifObject.userId, notifObject.hashControl)) {
                    userIds.push(notifObject.userId)
                }
            }
        })
        if (userIds.length) {
            console.log("in")
            this.sendNotif([...new Set(userIds)], message)
        }
    },
    /**********************************
     * notifie a la fois sur le site et via les notifs push
     * @param membersToNotifyIds
     * @param notifObjects
     * @param notifType
     * @param projectId
     * @param section
     */
    notifyGlobally(membersToNotifyIds, notifObjects, notifType, projectId, section, queryParams) {
        let url = "/project/" + projectId + "/" + section
        if (queryParams) {
            url += "?" + queryParams
        }
        let notif = new ProjectNotification({
            projectId: projectId,
            notifiedMembers: membersToNotifyIds,
            section: section,
            notifType: notifType,
            url: url,
        })
        notif.save()

        this.CheckThenNotify(membersToNotifyIds, notifObjects, notifType)
    }
}
export default NotifPush
