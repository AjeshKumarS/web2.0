// @flow
import * as React from "react";
import isEqual from "lodash/isEqual";
import flattenDeep from "lodash/flattenDeep";
import uniq from "lodash/uniq";
import intersection from "lodash/intersection";
import queryString from "query-string";
import type { ContextRouter } from "react-router-dom";
import type { MoiraUrlParams } from "../../Domain/MoiraUrlParams";
import type { IMoiraApi } from "../../Api/MoiraApi";
import transformPageFromHumanToProgrammer from "../../logic/transformPageFromHumanToProgrammer";
import { withMoiraApi } from "../../Api/MoiraApiInjection";

// ToDo вынести в хелперы
const clearInput = (input: string) => {
    let cleared = input;

    cleared = cleared.trim();
    cleared = cleared.replace(/[\s]+/g, " ");

    return cleared;
};

type Props = ContextRouter & { moiraApi: IMoiraApi };

type State = {
    loading: boolean,
    selectedTags: string[],
    subscribedTags: string[],
    allTags: string[],
    onlyProblems: boolean,
    triggers: ?TriggerList,
    activePage: number,
    pageCount: number,
};

class TriggerListPage extends React.Component<Props, State> {
    state: State = {
        loading: true,
        selectedTags: [],
        subscribedTags: [],
        allTags: [],
        onlyProblems: false,
        triggers: [],
        activePage: 1,
        pageCount: 1,
    };

    componentDidMount() {
        document.title = "Moira - Triggers";
        this.loadData();
    }

    componentDidUpdate({ location: prevLocation }) {
        const { location: currentLocation } = this.props;
        if (!isEqual(prevLocation, currentLocation)) {
            this.loadData();
        }
    }

    static parseLocationSearch(search: string): MoiraUrlParams {
        const START_PAGE = 1;
        const { page, tags, onlyProblems, searchText } = queryString.parse(search, {
            arrayFormat: "index",
        });

        return {
            page: Number.isNaN(Number(page)) ? START_PAGE : Math.abs(parseInt(page, 10)),
            tags: Array.isArray(tags) ? tags.map(value => value.toString()) : [],
            onlyProblems: onlyProblems === "false" ? false : Boolean(onlyProblems),
            searchText: clearInput(searchText || ""),
        };
    }

    render() {
        const {
            loading,
            selectedTags,
            subscribedTags,
            allTags,
            onlyProblems,
            triggers,
            activePage,
            pageCount,
            searchText,
        } = this.state;
        const { view: TriggerListView } = this.props;

        return loading ? (
            <div>Loading...</div>
        ) : (
            <TriggerListView
                searchText={searchText}
                selectedTags={selectedTags}
                subscribedTags={subscribedTags}
                allTags={allTags}
                onlyProblems={onlyProblems}
                triggers={triggers}
                activePage={activePage}
                pageCount={pageCount}
                onChange={this.changeLocationSearch}
            />
        );
    }

    async loadData() {
        const { location, moiraApi } = this.props;
        const locationSearch = TriggerListPage.parseLocationSearch(location.search);
        const redirected = this.loadLocalSettingsAndRedirectIfNeed(
            locationSearch.tags,
            locationSearch.onlyProblems
        );

        if (redirected) return;

        const tags = await this.loadTags();
        if (this.compareTagsAndRedirectIfHasUnknownTags(locationSearch.tags, tags.list)) return;

        // ToDo написать проверку на превышение страниц

        try {
            const [settings, triggers] = await Promise.all([
                moiraApi.getSettings(),
                moiraApi.getTriggerList(
                    transformPageFromHumanToProgrammer(locationSearch.page),
                    locationSearch.onlyProblems,
                    locationSearch.tags,
                    locationSearch.searchText
                ),
            ]);

            this.setState({
                selectedTags: locationSearch.tags,
                subscribedTags: uniq(flattenDeep(settings.subscriptions.map(item => item.tags))),
                allTags: tags.list,
                onlyProblems: locationSearch.onlyProblems,
                triggers: triggers.list,
                activePage: locationSearch.page,
                pageCount: Math.ceil(triggers.total / triggers.size),
                searchText: locationSearch.searchText,
                loading: false,
            });
        } catch (error) {
            this.setState({ loading: false });
            // ToDo обработать ошибку
        }
    }

    async loadTags() {
        const { moiraApi } = this.props;
        try {
            return await moiraApi.getTagList();
        } catch (error) {
            // TODO
            return {
                list: [],
            };
        }
    }

    loadLocalSettingsAndRedirectIfNeed(tags: string, onlyProblems: boolean) {
        const localDataString = localStorage.getItem("moiraSettings");
        const { tags: localTags, onlyProblems: localOnlyProblems } =
            typeof localDataString === "string" ? JSON.parse(localDataString) : {};

        let searchToUpdate = null;
        if (tags.length === 0 && localTags && localTags.length) {
            searchToUpdate = { ...(searchToUpdate || {}), tags: localTags };
        }
        if (!onlyProblems && localOnlyProblems) {
            searchToUpdate = { ...(searchToUpdate || {}), onlyProblems: localOnlyProblems };
        }
        if (searchToUpdate != null) {
            this.changeLocationSearch(searchToUpdate);
            return true;
        }
        return false;
    }

    compareTagsAndRedirectIfHasUnknownTags(parsedTags: string[], moiraTags: string[]) {
        const validSelectedTags = intersection(parsedTags, moiraTags);
        if (parsedTags.length > validSelectedTags.length) {
            this.changeLocationSearch({ tags: validSelectedTags });
            return true;
        }
        return false;
    }

    changeLocationSearch = update => {
        const { history, location } = this.props;
        const locationSearch = TriggerListPage.parseLocationSearch(location.search);
        const settings = { ...locationSearch, ...update };
        localStorage.setItem("moiraSettings", JSON.stringify({ ...settings, searchText: "" }));

        history.push(
            `?${queryString.stringify(settings, {
                arrayFormat: "index",
                encode: true,
            })}`
        );
    };
}

export default withMoiraApi(TriggerListPage);
