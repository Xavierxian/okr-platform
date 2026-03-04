--
-- PostgreSQL database dump
--

\restrict G8bXPzq0xVqX0DBI7iEcqo9Pq3wETdY0JjnXegtgXleLAVWCtUoYIxfIZqvutMU

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cycles (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    parent_id character varying,
    level integer DEFAULT 0 NOT NULL
);


--
-- Name: key_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key_results (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    objective_id character varying NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    assignee_id character varying,
    assignee_name text DEFAULT ''::text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    weight real DEFAULT 1 NOT NULL,
    status text DEFAULT 'normal'::text NOT NULL,
    self_score real,
    self_score_note text DEFAULT ''::text NOT NULL,
    progress_history jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    collaborator_id character varying,
    collaborator_name text DEFAULT ''::text NOT NULL,
    okr_type text DEFAULT '承诺型'::text NOT NULL
);


--
-- Name: kr_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kr_comments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    kr_id character varying NOT NULL,
    user_id character varying NOT NULL,
    user_name text NOT NULL,
    content text NOT NULL,
    mentioned_user_ids jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    type text DEFAULT 'comment_mention'::text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    related_kr_id character varying,
    related_objective_id character varying,
    from_user_id character varying,
    from_user_name text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objectives (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    department_id character varying NOT NULL,
    cycle text NOT NULL,
    parent_objective_id character varying,
    status text DEFAULT 'active'::text NOT NULL,
    is_collaborative boolean DEFAULT false NOT NULL,
    collaborative_dept_ids jsonb DEFAULT '[]'::jsonb,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    collaborative_user_ids jsonb DEFAULT '[]'::jsonb,
    linked_to_parent boolean DEFAULT false NOT NULL,
    okr_type text DEFAULT '承诺型'::text NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: user_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_departments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    department_id character varying NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    display_name text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    department_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    dingtalk_user_id text
);


--
-- Data for Name: cycles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cycles (id, name, sort_order, created_at) FROM stdin;
2c3ccab6-7186-465d-bb72-963bab1ae76d	2026 第一季度	1	2026-02-28 11:26:15.188768
d9f36559-a8e9-45fc-b1cc-b1776775cc5c	2026 第二季度	2	2026-02-28 11:26:15.267398
4d67b263-651c-4859-8378-aee197258af8	2026 第三季度	3	2026-02-28 11:26:15.271028
83b4e053-e812-4eef-ab4f-b03ca4ec52e4	2026 第四季度	4	2026-02-28 11:26:15.273642
ebb76008-114c-4780-97bf-8e01b61c763c	2026 年度	5	2026-02-28 11:26:15.277347
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, name, parent_id, level) FROM stdin;
dept_2	产品部	\N	0
dept_3	市场部	\N	0
dept_4	销售部	\N	0
dept_7	设计组	dept_2	1
\.


--
-- Data for Name: key_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.key_results (id, objective_id, title, description, assignee_id, assignee_name, start_date, end_date, progress, weight, status, self_score, self_score_note, progress_history, created_at, collaborator_id, collaborator_name, okr_type) FROM stdin;
5cc5c8e3-53c9-4f44-907e-e0aef28c6a9a	55aceb57-455f-4229-9585-401688f89c9a	测试协同KR	用于测试跨部门协同的KR	test_user_2	测试用户二	2026-02-28	2026-05-28	0	1	normal	\N		[]	2026-02-28 07:11:10.030583	admin_1	超级管理员	承诺型
6146e81a-5f54-4cc4-bce4-c0b5eaed1a3e	55aceb57-455f-4229-9585-401688f89c9a	关键结果1（已修改）		\N	测试人员	2026-02-28	2026-05-28	0	1	normal	\N		[]	2026-02-28 04:28:20.23272	\N		承诺型
a5c4d1e0-7f46-4eba-b9a5-4ed161943bbb	743b87e2-f9ef-474d-b764-17972a0c72b3	自动创建 KR 测试		\N		2026-02-28	2026-05-28	0	1	normal	\N		[]	2026-02-28 07:38:39.236955	\N		承诺型
\.


--
-- Data for Name: kr_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kr_comments (id, kr_id, user_id, user_name, content, mentioned_user_ids, created_at) FROM stdin;
39c332be-8fe5-489c-a1b2-d20dae341c08	5cc5c8e3-53c9-4f44-907e-e0aef28c6a9a	admin_1	超级管理员	测试评论 @测试用户二 请查看	["test_user_2"]	2026-03-02 04:31:12.686515
5dd62a99-ad98-4c90-98ab-1691d7d72ba5	a5c4d1e0-7f46-4eba-b9a5-4ed161943bbb	admin_1	超级管理员	@测试用户二  请查看进度	["test_user_2"]	2026-03-02 04:36:12.514524
177cf9c1-b6e1-43ad-b402-f3edca6fcf4e	a5c4d1e0-7f46-4eba-b9a5-4ed161943bbb	admin_1	超级管理员	@测试用户二  请看一下这个进度	["test_user_2"]	2026-03-02 04:54:13.891416
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, content, related_kr_id, related_objective_id, from_user_id, from_user_name, is_read, created_at) FROM stdin;
64ad4ce0-aba9-4505-a191-cb4162a85beb	test_user_2	comment_mention	超级管理员 在评论中提到了你	测试评论 @测试用户二 请查看	5cc5c8e3-53c9-4f44-907e-e0aef28c6a9a	55aceb57-455f-4229-9585-401688f89c9a	admin_1	超级管理员	f	2026-03-02 04:31:12.693876
9a3c27a3-fe88-49de-9a17-9233f054aade	test_user_2	comment_mention	超级管理员 在评论中提到了你	@测试用户二  请查看进度	a5c4d1e0-7f46-4eba-b9a5-4ed161943bbb	743b87e2-f9ef-474d-b764-17972a0c72b3	admin_1	超级管理员	f	2026-03-02 04:36:12.52362
b77bc568-42ba-4deb-88e0-4905b3df9d88	test_user_2	comment_mention	超级管理员 在评论中提到了你	@测试用户二  请看一下这个进度	a5c4d1e0-7f46-4eba-b9a5-4ed161943bbb	743b87e2-f9ef-474d-b764-17972a0c72b3	admin_1	超级管理员	f	2026-03-02 04:54:13.926874
\.


--
-- Data for Name: objectives; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.objectives (id, title, description, department_id, cycle, parent_objective_id, status, is_collaborative, collaborative_dept_ids, created_by, created_at, collaborative_user_ids, linked_to_parent, okr_type) FROM stdin;
743b87e2-f9ef-474d-b764-17972a0c72b3	测试目标_1772255809314		dept_1	2026 第一季度	\N	active	t	[]	admin_1	2026-02-28 05:18:31.874819	[]	f	承诺型
eb107cda-da60-4a7c-a572-dcb068f49df2	导航测试目标		dept_1	2026 第一季度	\N	active	f	[]	admin_1	2026-02-28 05:22:57.0832	[]	f	承诺型
a6635e3c-8ebd-43e7-82d9-b5aa91179c8d	测试目标单选		dept_1	2026 第一季度	\N	active	f	[]	admin_1	2026-02-28 06:26:59.709179	[]	f	承诺型
55aceb57-455f-4229-9585-401688f89c9a	测试目标ABC（已修改）	测试描述	dept_1	2026 第一季度	\N	active	f	[]	admin_1	2026-02-28 04:27:49.789076	[]	f	承诺型
79788166-7715-4b79-9f58-9a958fa0f25e	测试目标-多部门		dept_3	2026 第二季度	\N	active	f	[]	admin_1	2026-03-01 10:22:00.676653	[]	t	挑战型
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session (sid, sess, expire) FROM stdin;
pwiFo8BkAa3BfS9qs-wrLu6FzIZX0cqj	{"cookie":{"originalMaxAge":604800000,"expires":"2026-03-10T06:17:14.967Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"admin_1"}	2026-03-10 06:18:15
cC7Wuq7KJWUrU3kf7WIzvMMkMCZaLjXI	{"cookie":{"originalMaxAge":604800000,"expires":"2026-03-07T08:15:38.507Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"admin_1"}	2026-03-07 08:17:33
JzJI2xkMz5l-jjSvyNmqopqwOfiXVQC1	{"cookie":{"originalMaxAge":604800000,"expires":"2026-03-10T06:48:22.055Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"admin_1"}	2026-03-10 06:48:53
bB2jzx__Dfm6uLufQpVoOq6sTq6Gcyp7	{"cookie":{"originalMaxAge":604800000,"expires":"2026-03-10T08:19:23.769Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"admin_1"}	2026-03-10 08:20:15
lKELZA772QABkKc1-tM-vrdDjySHpZeN	{"cookie":{"secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"admin_1"}	2026-03-04 04:00:58
I4Ik5-YkF6gHzH5YyEdrUjq43qdyU70-	{"cookie":{"secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"admin_1"}	2026-03-03 10:27:10
ap_ZoFf1444EskCU74FdAb5crGnVahzc	{"cookie":{"originalMaxAge":604800000,"expires":"2026-03-10T09:03:27.658Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"admin_1"}	2026-03-10 09:04:59
2VhBwYA6aMNirqmBkEwMnEduho2sBVBN	{"cookie":{"secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"admin_1"}	2026-03-04 05:10:53
iN-Id36fRQITXtjJRSfwlxOiH27sgB74	{"cookie":{"secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"admin_1"}	2026-03-04 05:28:57
\.


--
-- Data for Name: user_departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_departments (id, user_id, department_id) FROM stdin;
e11f84fd-436f-42ff-a8c5-8a43710b65df	test_user_2	dept_1
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, password, display_name, role, department_id, created_at, dingtalk_user_id) FROM stdin;
admin_1	admin	$2b$10$y/dWe5a3McC.pX7.tQCFhe7uyx1zQtnrN4I.MqVRIj5isaikTvY3i	超级管理员	super_admin	\N	2026-02-28 04:15:39.461504	\N
test_user_2	testuser2	test	测试用户二	member	dept_1	2026-02-28 06:28:18.288156	\N
\.


--
-- Name: cycles cycles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycles
    ADD CONSTRAINT cycles_name_key UNIQUE (name);


--
-- Name: cycles cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycles
    ADD CONSTRAINT cycles_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: key_results key_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_results
    ADD CONSTRAINT key_results_pkey PRIMARY KEY (id);


--
-- Name: kr_comments kr_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kr_comments
    ADD CONSTRAINT kr_comments_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: objectives objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: user_departments user_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT user_departments_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- PostgreSQL database dump complete
--

\unrestrict G8bXPzq0xVqX0DBI7iEcqo9Pq3wETdY0JjnXegtgXleLAVWCtUoYIxfIZqvutMU

