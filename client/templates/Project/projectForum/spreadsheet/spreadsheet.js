import projectController from "../../../../lib/controllers/projectController";
import cryptoTools from "../../../../lib/cryptoTools";
import Spreadsheet from "/imports/classes/Spreadsheet";
import Project from "../../../../../imports/classes/Project";
import Publications from "../../../../../lib/collections/Publications";
import Publication from "../../../../../imports/classes/Publication"
    import jexcel from "jexcel";
import Spreadsheets from "../../../../../lib/collections/Spreadsheets";

Template.spreadsheet.helpers({
    //add you helpers here
    currentSpreadsheet: function () {
        return Template.instance().currentSpreadsheet.get()
    },
    isRefreshing: function () {
        return Template.instance().isRefreshing.get()
    },
    refreshScrollbar: function () {
        return Template.currentData().refreshScrollbar
    },
    refreshRender: function () {
        let instance = Template.instance()
        let currentSpreadsheet = Template.instance().currentSpreadsheet.get()
        return ()=>{
            instance.currentSpreadsheet.set(false)
            Meteor.setTimeout(()=>{
                instance.currentSpreadsheet.set(currentSpreadsheet)
            },500)
        }
    }

});

Template.spreadsheet.events({
    //add your events here
});

Template.spreadsheet.onCreated(function () {
    //add your statement here
    this.currentSpreadsheet = new ReactiveVar()
    this.isRefreshing = new ReactiveVar(true)
    this.projectId = new ReactiveVar(null)
    this.handlerSubscription = null
    this.pinnedPublication = new ReactiveVar(false)
    this.autorun(() => {

        this.isRefreshing.set(true)
        FlowRouter.watchPathChange()
        let currentProject = Project.findOne(FlowRouter.current().params.projectId)
        if (currentProject) {

            this.projectId.set(FlowRouter.current().params.projectId)
            let spreadsheetId = FlowRouter.current().queryParams.spreadsheetId
            this.handlerSubscription = Meteor.subscribe("singleSpreadsheet", projectController.getAuthInfo(this.projectId.get()), spreadsheetId, this.projectId.get(), err => {

                if (err) {
                    console.log(err)
                } else {
                    this.autorun(() => {
                        let encryptedSpreadsheet = Spreadsheets.findOne({_id: spreadsheetId})
                        if(encryptedSpreadsheet.currentEditor){
                            cryptoTools.decryptObject(encryptedSpreadsheet, {symKey: Session.get("currentProjectSimKey")}, (spreadsheet) => {
                                this.currentSpreadsheet.set(spreadsheet)
                                this.isRefreshing.set(false)
                            })
                        }

                    })
                }
            })
        }
    })
});

Template.spreadsheet.onRendered(function () {
    //add your statement here


});

Template.spreadsheet.onDestroyed(function () {
    //add your statement here
});

