// @flow
import React from 'react';
import moment from 'moment';
import type { ContextRouter } from 'react-router-dom';
import type { IMoiraApi } from '../Api/MoiraAPI';
import type { Trigger, TriggerState } from '../Domain/Trigger';
import type { Metric } from '../Domain/Metric';
import type { Maintenance } from '../Domain/Maintenance';
import type { Event } from '../Domain/Event';
import { withMoiraApi } from '../Api/MoiraApiInjection';
import { getMaintenanceTime } from '../Domain/Maintenance';
import TriggerInfo from '../Components/TriggerInfo/TriggerInfo';
import MetricList from '../Components/MetricList/MetricList';
import Tabs, { Tab } from '../Components/Tabs/Tabs';
import EventList from '../Components/EventList/EventList';
import Layout, { LayoutPlate, LayoutContent } from '../Components/Layout/Layout';

type Props = ContextRouter & { moiraApi: IMoiraApi };
type State = {|
    loading: boolean;
    error: ?string;
    trigger: ?Trigger;
    triggerState: ?TriggerState;
    triggerEvents: ?{|
        total: number;
        list: Array<Event>;
        page: number;
        size: number;
    |};
|};

class TriggerContainer extends React.Component {
    props: Props;
    state: State = {
        loading: true,
        error: null,
        trigger: null,
        triggerState: null,
        triggerEvents: null,
    };

    componentDidMount() {
        this.getData(this.props);
    }

    async getData(props: Props): Promise<void> {
        const { moiraApi, match } = props;
        const { id } = match.params;
        if (typeof id !== 'string') {
            return;
        }
        try {
            const trigger = await moiraApi.getTrigger(id);
            const triggerState = await moiraApi.getTriggerState(id);
            const triggerEvents = await moiraApi.getTriggerEvents(id);
            this.setState({
                loading: false,
                trigger,
                triggerState,
                triggerEvents,
            });
        }
        catch (error) {
            this.setState({ error: 'Network error. Please, reload page' });
        }
    }

    async setMaintenance(triggerId: string, maintenance: Maintenance, metric: string): Promise<void> {
        this.setState({ loading: true });
        const maintenanceTime = getMaintenanceTime(maintenance);
        await this.props.moiraApi.setMaintenance(triggerId, {
            [metric]:
                maintenanceTime > 0
                    ? moment
                          .utc()
                          .add(maintenanceTime, 'minutes')
                          .unix()
                    : maintenanceTime,
        });
        this.getData(this.props);
    }

    async removeMetric(triggerId: string, metric: string): Promise<void> {
        this.setState({ loading: true });
        await this.props.moiraApi.delMetric(triggerId, metric);
        this.getData(this.props);
    }

    async disableTrhrottling(triggerId: string): Promise<void> {
        this.setState({ loading: true });
        await this.props.moiraApi.delThrottling(triggerId);
        this.getData(this.props);
    }

    composeMetrics(): Array<{ name: string; data: Metric }> {
        const { metrics } = this.state.triggerState || {};
        return metrics ? Object.keys(metrics).map(x => ({ name: x, data: metrics[x] })) : []; // TODO
    }

    render(): React.Element<*> {
        const { loading, error, trigger, triggerEvents } = this.state;
        return (
            <Layout loading={loading} error={error}>
                {trigger && (
                    <LayoutPlate>
                        <TriggerInfo
                            data={trigger}
                            onThrottlingRemove={triggerId => {
                                this.disableTrhrottling(triggerId);
                            }}
                        />
                    </LayoutPlate>
                )}
                {trigger && (
                    <LayoutContent>
                        <Tabs value='state'>
                            {this.composeMetrics().length !== 0 && (
                                <Tab id='state' label='Current state'>
                                    <MetricList
                                        status
                                        items={this.composeMetrics()}
                                        onChange={(maintenance, metric) => {
                                            this.setMaintenance(trigger.id, maintenance, metric);
                                        }}
                                        onRemove={metric => {
                                            this.removeMetric(trigger.id, metric);
                                        }}
                                    />
                                </Tab>
                            )}
                            {triggerEvents &&
                            triggerEvents.list.length !== 0 && (
                                <Tab id='events' label='Events history'>
                                    <EventList items={triggerEvents.list} />
                                </Tab>
                            )}
                        </Tabs>
                    </LayoutContent>
                )}
            </Layout>
        );
    }
}

export default withMoiraApi(TriggerContainer);
